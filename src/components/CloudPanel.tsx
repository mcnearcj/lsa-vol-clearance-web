import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cloudConfigured, getClient, type VaultRow } from '../cloud/client'
import { b64, decryptJson, deriveAuthSecret, deriveKey, encryptJson, newSalt } from '../cloud/crypto'
import { keystore } from '../cloud/keystore'
import { isEmpty, merge, same, type SyncData } from '../cloud/merge'
import { useStored } from '../storage'
import type { Profile, Progress } from '../types'

// One password does two jobs, both worked out on this device:
//  - a sign-in secret derived from it is what the sign-in service sees (never the password itself)
//  - an encryption key derived from it (with a different, random salt) locks the synced copy before upload
// So the server can't read synced copies, and a password reset gets you back in but can't open an old copy.
// Once signed in, sync runs automatically unless the person opted out at their first sign-in on this device.
//
// Keeping several tabs and devices in step:
//  - each device remembers the last version it and the server agreed on (the "base")
//  - a sync fetches the server copy; if someone else saved since the base, their changes are merged in (see merge.ts)
//  - a save only succeeds if nobody else saved since the base; otherwise it fetches and merges first
//  - devices sync when the page comes back into view and every minute while it's open

interface Snapshot {
  v: 1
  profile: Profile
  progress: Progress
}

export type SyncStatus = 'unavailable' | 'signed-out' | 'locked' | 'attention' | 'saving' | 'saved' | 'manual' | 'error'

interface Props {
  profile: Profile
  progress: Progress
  onRestore: (data: { profile: Profile; progress: Progress }) => void
  /** Changes from another device were merged into this one. */
  onRemoteUpdate?: () => void
  onStatus?: (status: SyncStatus, savedAt: string | null, email: string | null) => void
  /** Changes when the person erases their data on this device; signs out so an empty device is never backed up. */
  resetToken?: number
}

interface Vault {
  key: CryptoKey
  salt: string
}

type Mode = 'signin' | 'create' | 'forgot'

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const here = () => window.location.origin + window.location.pathname
const WRONG = 'That email and password don’t match an account.'
// Sign-in emails are sent by Supabase, the service that runs accounts for this site. Say so, so they aren't mistaken for spam.
const SENDER = 'Supabase Auth (noreply@mail.app.supabase.io)'

/** Supabase sends people back with details in the URL hash (after confirming email or resetting a password). */
function readAuthHash(): { error?: string; recovery: boolean } {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const code = params.get('error_code')
  const recovery = params.get('type') === 'recovery'
  if (code === 'otp_expired') return { error: 'That email link has expired. Sign in below, or use “I’m new” again to get a new link.', recovery }
  const desc = params.get('error_description')
  return { error: desc ? desc.replace(/\+/g, ' ') : undefined, recovery }
}

interface Base {
  userId: string
  /** The server's updated_at for the version both sides agreed on. */
  time: string
  data: SyncData | null
}
const noBase: Base = { userId: '', time: '', data: null }

const POLL_MS = 60_000

export function CloudPanel({ profile, progress, onRestore, onRemoteUpdate, onStatus, resetToken = 0 }: Props) {
  const [pref, setPref] = useStored('cloud', { autoSync: true, decided: false })
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [recovering, setRecovering] = useState(() => cloudConfigured && readAuthHash().recovery)
  const [user, setUserState] = useState<{ id: string; email: string } | null>(null)
  const userRef = useRef(user)
  // Update the ref immediately: a sync started right after sign-in must know whose copy it's syncing.
  const setUser = useCallback((u: { id: string; email: string } | null) => {
    userRef.current = u
    setUserState(u)
  }, [])
  const [vault, setVault] = useState<Vault | null>(null)
  // A synced copy exists but this password can't open it (it was saved before a password reset).
  const [stale, setStale] = useState(false)
  // The synced copy and this device both have different info; the person chooses which to keep.
  const [conflict, setConflict] = useState<{ data: SyncData; time: string } | null>(null)
  const [cloudTime, setCloudTime] = useState<string | null>(null)
  // Automatic saving starts only once the synced copy and this device agree, so an empty device can't overwrite a good copy.
  const [reconciled, setReconciled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(() => (cloudConfigured ? (readAuthHash().error ?? '') : ''))
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Stored, so a reload (and other tabs) remember what this device last agreed with the server.
  const [base, setBase] = useStored<Base>('syncBase', noBase)
  const latest = useRef<SyncData>({ profile, progress })
  const baseRef = useRef(base)
  useEffect(() => {
    latest.current = { profile, progress }
  }, [profile, progress])
  useEffect(() => {
    baseRef.current = base
  }, [base])

  const remember = useCallback(
    (time: string, data: SyncData | null) => {
      const next = { userId: userRef.current?.id ?? '', time, data }
      baseRef.current = next
      setBase(next)
    },
    [setBase],
  )

  // Syncs run one at a time per tab, so a save and a fetch never race each other here.
  const queue = useRef(Promise.resolve())
  const enqueue = useCallback((task: () => Promise<void>) => {
    const next = queue.current.then(task, task)
    queue.current = next.catch(() => {})
    return next
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const fetchRow = useCallback(async (): Promise<VaultRow | null> => {
    const c = await getClient()
    const { data, error: err } = await c.from('vault').select('salt, iv, ciphertext, updated_at').maybeSingle()
    if (err) throw new Error(err.message)
    return data as VaultRow | null
  }, [])

  /** Uploads this device's info, but only if nobody else has saved since `expected` (null: there's no copy yet). */
  const push = useCallback(
    async (v: Vault, expected: string | null): Promise<'saved' | 'changed'> => {
      const c = await getClient()
      const u = userRef.current
      if (!u) throw new Error('You’ve been signed out. Sign in again to keep syncing.')
      const data: SyncData = { ...latest.current }
      const snapshot: Snapshot = { v: 1, ...data }
      const { iv, ciphertext } = await encryptJson(v.key, snapshot)
      const fields = { salt: v.salt, iv, ciphertext, updated_at: new Date().toISOString() }
      let time: string | undefined
      if (expected === null) {
        const { data: rows, error: err } = await c.from('vault').insert({ user_id: u.id, ...fields }).select('updated_at')
        if (err?.code === '23505') return 'changed' // another device created it first
        if (err) throw new Error(err.message)
        time = rows?.[0]?.updated_at
      } else {
        const { data: rows, error: err } = await c.from('vault').update(fields).eq('user_id', u.id).eq('updated_at', expected).select('updated_at')
        if (err) throw new Error(err.message)
        if (!rows?.length) return 'changed' // someone saved since we last looked
        time = rows[0].updated_at
      }
      remember(time ?? fields.updated_at, data)
      setCloudTime(time ?? fields.updated_at)
      setStale(false)
      setConflict(null)
      setReconciled(true)
      setSyncError(false)
      return 'saved'
    },
    [remember],
  )

  /**
   * Brings this device and the synced copy into agreement: uploads local changes, merges in changes from other
   * devices, loads the copy onto an empty device, or asks when two devices with no shared history disagree.
   */
  const sync = useCallback(
    async (v: Vault, auto: boolean, attempt = 0): Promise<void> => {
      const row = await fetchRow()
      const b = baseRef.current.userId === userRef.current?.id ? baseRef.current : noBase
      const local = latest.current

      if (!row) {
        if (b.time) {
          // It existed when this device last synced, so it was deleted on purpose somewhere else.
          remember('', null)
          setCloudTime(null)
          setReconciled(false)
          setPref({ autoSync: false, decided: true })
          setMessage('Your synced copy was deleted on another device, so sync is off here. Everything on this device is still here.')
          return
        }
        setCloudTime(null)
        if (auto && (await push(v, null)) === 'changed' && attempt < 2) await sync(v, auto, attempt + 1)
        return
      }

      let remote: SyncData
      try {
        const snap = await decryptJson<Snapshot>(v.key, row.iv, row.ciphertext)
        remote = { profile: snap.profile, progress: snap.progress }
      } catch {
        setStale(true)
        setCloudTime(row.updated_at)
        return
      }
      setStale(false)
      setCloudTime(row.updated_at)
      if (!auto) return

      let target = local
      if (b.data && b.time === row.updated_at) {
        // Nobody else saved. Upload this device's changes, if any.
        setReconciled(true)
        if (same(local, b.data)) return
      } else if (b.data) {
        // Someone else saved: merge their changes with this device's.
        target = merge(b.data, local, remote)
        if (!same(target, local)) {
          onRestore(target)
          latest.current = target
          onRemoteUpdate?.()
        }
        remember(row.updated_at, remote)
        setReconciled(true)
        if (same(target, remote)) return
      } else if (isEmpty(local)) {
        onRestore(remote)
        latest.current = remote
        remember(row.updated_at, remote)
        setReconciled(true)
        setMessage('Your synced info was loaded onto this device.')
        return
      } else if (same(local, remote)) {
        remember(row.updated_at, remote)
        setReconciled(true)
        return
      } else {
        // First sync on this device and both sides have different info: ask which to keep.
        setConflict({ data: remote, time: row.updated_at })
        return
      }
      if ((await push(v, row.updated_at)) === 'changed' && attempt < 2) await sync(v, auto, attempt + 1)
    },
    [fetchRow, push, remember, onRestore, onRemoteUpdate, setPref],
  )

  const forget = useCallback(
    async (userId?: string) => {
      if (userId) await keystore.remove(userId)
      setVault(null)
      setStale(false)
      setConflict(null)
      setReconciled(false)
      setCloudTime(null)
      baseRef.current = noBase
      setBase(noBase)
    },
    [setBase],
  )

  // Pick up an existing sign-in (and its remembered key), and anything an email link brought back.
  useEffect(() => {
    if (!cloudConfigured) return
    const hadError = Boolean(readAuthHash().error)
    let live = true
    let unsubscribe = () => {}
    getClient()
      .then(async (c) => {
        const { data: sub } = c.auth.onAuthStateChange((event, session) => {
          if (!live) return
          if (event === 'PASSWORD_RECOVERY') setRecovering(true)
          setUser(session ? { id: session.user.id, email: session.user.email ?? '' } : null)
        })
        unsubscribe = () => sub.subscription.unsubscribe()
        const { data } = await c.auth.getSession()
        const u = data.session?.user
        if (!live) return
        setUser(u ? { id: u.id, email: u.email ?? '' } : null)
        if (hadError && window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search)
        if (u) {
          const stored = await keystore.get(u.id)
          if (stored && live) {
            setVault(stored)
            await enqueue(() => sync(stored, pref.autoSync)).catch(() => setSyncError(true))
          }
        }
      })
      .catch(() => {})
    return () => {
      live = false
      unsubscribe()
    }
    // Runs once on load; later preference changes are handled where they happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Erasing this device's data signs out of sync here, so the empty device is never saved over the synced copy.
  const firstReset = useRef(resetToken)
  useEffect(() => {
    if (resetToken === firstReset.current) return
    firstReset.current = resetToken
    void (async () => {
      await forget()
      setUser(null)
      await keystore.clear()
      setPref({ autoSync: true, decided: false })
      const c = await getClient().catch(() => null)
      await c?.auth.signOut()
    })()
  }, [resetToken, forget, setPref, setUser])

  /** Signs in with the secret derived from the password; the password itself is never sent. */
  const signInWith = async (addr: string, pw: string) => {
    const c = await getClient()
    const { data, error: err } = await c.auth.signInWithPassword({ email: addr, password: await deriveAuthSecret(addr, pw) })
    if (err) throw new Error(err.message === 'Invalid login credentials' ? WRONG : err.message)
    return data.user
  }

  /** Works out the encryption key from the password, remembers it on this device, then reconciles. */
  const unlockWith = async (userId: string, pw: string, auto: boolean) => {
    const row = await fetchRow()
    let v: Vault | null = null
    if (row) {
      const key = await deriveKey(pw, b64.from(row.salt))
      try {
        await decryptJson<Snapshot>(key, row.iv, row.ciphertext)
        v = { key, salt: row.salt }
      } catch {
        // Can't open the existing copy with this password; a new key will replace it on the next save.
      }
    }
    if (!v) {
      const salt = newSalt()
      v = { key: await deriveKey(pw, salt), salt: b64.to(salt) }
    }
    await keystore.put(userId, v)
    setVault(v)
    await enqueue(() => sync(v, auto))
  }

  const submitAccount = () =>
    run(async () => {
      const c = await getClient()
      const addr = email.trim()
      if (mode === 'forgot') {
        const { error: err } = await c.auth.resetPasswordForEmail(addr, { redirectTo: here() })
        if (err) throw new Error(err.message)
        setMessage(`If that email has an account, a reset link is on its way from ${SENDER}. Open it on this device. Check your spam folder if you don’t see it.`)
        return
      }
      if (password.length < 8) throw new Error('Your password needs at least 8 characters.')
      const auto = pref.decided ? pref.autoSync : optIn
      if (!pref.decided) setPref({ autoSync: optIn, decided: true })
      if (mode === 'create') {
        if (password !== password2) throw new Error('The two passwords don’t match.')
        const { data, error: err } = await c.auth.signUp({
          email: addr,
          password: await deriveAuthSecret(addr, password),
          options: { emailRedirectTo: here() },
        })
        if (err) throw new Error(err.message)
        if (!data.session) {
          setMessage(`Almost done. Check ${addr} for a confirmation email from ${SENDER} and open the link on this device. Check your spam folder if you don’t see it in a few minutes.`)
          setMode('signin')
          setPassword('')
          setPassword2('')
          return
        }
        setUser({ id: data.session.user.id, email: data.session.user.email ?? addr })
        await unlockWith(data.session.user.id, password, auto)
      } else {
        const u = await signInWith(addr, password)
        setUser({ id: u.id, email: u.email ?? addr })
        await unlockWith(u.id, password, auto)
      }
      setPassword('')
      setPassword2('')
    })

  // Signed in from an email link or on a browser that couldn't remember the key: the password is needed again.
  const unlockSession = () =>
    run(async () => {
      if (!user) return
      const u = await signInWith(user.email, password)
      await unlockWith(u.id, password, pref.autoSync)
      setPassword('')
    })

  const setPasswordFromLink = () =>
    run(async () => {
      if (!user) return
      if (password.length < 8) throw new Error('Your password needs at least 8 characters.')
      if (password !== password2) throw new Error('The two passwords don’t match.')
      const c = await getClient()
      const { error: err } = await c.auth.updateUser({ password: await deriveAuthSecret(user.email, password) })
      if (err) throw new Error(err.message)
      await unlockWith(user.id, password, pref.autoSync)
      setPassword('')
      setPassword2('')
      setRecovering(false)
      setMessage('Password updated. You’re signed in.')
    })

  const signOut = () =>
    run(async () => {
      const c = await getClient()
      await forget(user?.id)
      await c.auth.signOut()
      setUser(null)
    })

  const saveNow = () =>
    run(() =>
      enqueue(async () => {
        if (!vault) return
        // Replace whatever is there with this device's info (the person chose this).
        const row = await fetchRow()
        if ((await push(vault, row?.updated_at ?? null)) === 'changed') throw new Error('Another device just saved. Try again.')
        setMessage('Synced. Everything is up to date.')
      }),
    )

  const restore = (data?: SyncData, time?: string) =>
    run(() =>
      enqueue(async () => {
        if (!vault) return
        let snap = data
        let at = time
        if (!snap) {
          const row = await fetchRow()
          if (!row) throw new Error('There’s no saved copy yet.')
          const s = await decryptJson<Snapshot>(vault.key, row.iv, row.ciphertext)
          snap = { profile: s.profile, progress: s.progress }
          at = row.updated_at
          setCloudTime(row.updated_at)
        }
        onRestore(snap)
        latest.current = snap
        if (at) remember(at, snap)
        setConflict(null)
        setReconciled(true)
        setMessage('Done. This device now matches your synced copy.')
      }),
    )

  const setAuto = (on: boolean) => {
    setPref({ autoSync: on, decided: true })
    if (on && vault) void run(() => enqueue(() => sync(vault, true)))
  }

  const deleteCloud = () =>
    run(async () => {
      const c = await getClient()
      const { error: err } = await c.from('vault').delete().not('user_id', 'is', null)
      if (err) throw new Error(err.message)
      setCloudTime(null)
      setStale(false)
      setReconciled(false)
      setConfirmDelete(false)
      remember('', null)
      setPref({ autoSync: false, decided: true })
      setMessage('Your synced copy was deleted and sync is off. Everything on this device is still here.')
    })

  // Keep the synced copy current while automatic sync is on. Waits for a pause in edits.
  const autoOn = pref.autoSync && Boolean(vault) && reconciled && !stale && !conflict
  const runAuto = useCallback(() => {
    if (!vault) return
    setSaving(true)
    enqueue(() => sync(vault, true))
      .then(() => setSyncError(false))
      .catch(() => setSyncError(true))
      .finally(() => setSaving(false))
  }, [vault, enqueue, sync])
  useEffect(() => {
    if (!autoOn) return
    const t = setTimeout(runAuto, 2000)
    return () => clearTimeout(t)
  }, [autoOn, profile, progress, runAuto])

  // Pick up changes from other devices: when the page comes back into view, and every minute while it's showing.
  useEffect(() => {
    if (!autoOn) return
    const onVisible = () => document.visibilityState === 'visible' && runAuto()
    const poll = setInterval(onVisible, POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [autoOn, runAuto])

  // Tell the rest of the site how sync is doing, for the status shown under the header.
  const status: SyncStatus = !cloudConfigured
    ? 'unavailable'
    : !user
      ? 'signed-out'
      : !vault || recovering
        ? 'locked'
        : conflict || stale
          ? 'attention'
          : syncError
            ? 'error'
            : saving
              ? 'saving'
              : pref.autoSync && reconciled
                ? 'saved'
                : 'manual'
  useEffect(() => {
    onStatus?.(status, cloudTime, user?.email ?? null)
  }, [status, cloudTime, user, onStatus])

  if (!cloudConfigured) {
    return (
      <section className="panel">
        <h3>Sync</h3>
        <p>Sync isn’t turned on for this site. Your info stays in this browser.</p>
      </section>
    )
  }

  const step = (n: number, title: string, state: 'done' | 'active' | 'todo', body: ReactNode, aside?: ReactNode) => (
    <li className={`step ${state}`}>
      <span className="step-num" aria-hidden>
        {state === 'done' ? '✓' : n}
      </span>
      <div className="step-body">
        <div className="step-title">
          <h4>{title}</h4>
          {aside}
        </div>
        {body}
      </div>
    </li>
  )

  const passwordField = (label: string, id: string, value: string, set: (v: string) => void, autoComplete: string, hint?: string) => (
    <label className="field">
      <span>{label}</span>
      <input id={id} type="password" autoComplete={autoComplete} minLength={8} value={value} onChange={(e) => set(e.target.value)} required />
      {hint && <small>{hint}</small>}
    </label>
  )

  const form = (onSubmit: () => void, children: ReactNode) => (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {children}
    </form>
  )

  let step1: ReactNode
  if (user && recovering) {
    step1 = form(
      () => void setPasswordFromLink(),
      <>
        <p>Choose a new password for {user.email}.</p>
        {passwordField('New password', 'cloud-new-password', password, setPassword, 'new-password', 'At least 8 characters.')}
        {passwordField('Type it again', 'cloud-new-password-2', password2, setPassword2, 'new-password')}
        <div className="row">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </div>
      </>,
    )
  } else if (user && !vault) {
    step1 = form(
      () => void unlockSession(),
      <>
        <p>Signed in as {user.email}. Enter your password to turn sync back on for this device.</p>
        {passwordField('Password', 'cloud-password', password, setPassword, 'current-password')}
        <div className="row">
          <button className="primary" type="submit" disabled={busy || !password}>
            {busy ? 'Signing in…' : 'Continue'}
          </button>
          <button type="button" className="ghost" onClick={() => void signOut()} disabled={busy}>
            Use a different account
          </button>
        </div>
      </>,
    )
  } else if (user) {
    step1 = <p className="small">{user.email}</p>
  } else {
    step1 = form(
      () => void submitAccount(),
      <>
        <div className="seg" role="group" aria-label="Account">
          <button type="button" className={mode !== 'create' ? 'on' : ''} aria-pressed={mode !== 'create'} onClick={() => setMode('signin')}>
            I have an account
          </button>
          <button type="button" className={mode === 'create' ? 'on' : ''} aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
            I’m new
          </button>
        </div>
        <label className="field">
          <span>Email</span>
          <input id="cloud-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode !== 'forgot' &&
          passwordField(
            mode === 'create' ? 'Choose a password' : 'Password',
            'cloud-password',
            password,
            setPassword,
            mode === 'create' ? 'new-password' : 'current-password',
            mode === 'create' ? 'At least 8 characters.' : undefined,
          )}
        {mode === 'create' && passwordField('Type it again', 'cloud-password-2', password2, setPassword2, 'new-password')}
        {mode !== 'forgot' && !pref.decided && (
          <label className="check">
            <input id="cloud-optin" type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <span>
              Sync my info and checklist automatically
              <small> Recommended. You can turn this off later.</small>
            </span>
          </label>
        )}
        {mode === 'create' && (
          <p className="small">
            You’ll get a confirmation email from <strong>Supabase</strong>, the service this site uses to run accounts. It’s safe to open.
          </p>
        )}
        {mode === 'create' && (
          <p className="callout">Keep your password somewhere safe. If you reset it later, your old synced copy can’t be opened, but everything on your device stays and syncs again.</p>
        )}
        {mode === 'forgot' && (
          <p className="small">After resetting, you’ll be signed back in. Your old synced copy can’t be opened with a new password, so it’s replaced with what’s on this device.</p>
        )}
        <div className="row">
          <button className="primary" type="submit" disabled={busy}>
            {busy
              ? mode === 'create'
                ? 'Creating account…'
                : mode === 'forgot'
                  ? 'Sending…'
                  : 'Signing in…'
              : mode === 'create'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Sign in'}
          </button>
          {mode === 'signin' && (
            <button type="button" className="ghost" onClick={() => setMode('forgot')}>
              Forgot password?
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" className="ghost" onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          )}
        </div>
      </>,
    )
  }

  const step1Done = Boolean(user && vault && !recovering)

  let state: ReactNode
  if (conflict) {
    state = (
      <div className="choice" role="alert">
        <p>
          <strong>Your synced copy and this device have different info.</strong> Which do you want to keep? The other will be replaced.
        </p>
        <div className="row">
          <button className="primary" onClick={() => void restore(conflict.data, conflict.time)} disabled={busy}>
            Use my synced copy (saved {when(conflict.time)})
          </button>
          <button className="secondary" onClick={() => void saveNow()} disabled={busy}>
            Keep this device’s info
          </button>
        </div>
      </div>
    )
  } else if (stale) {
    state = (
      <div className="choice" role="alert">
        <p>You have an older synced copy that can’t be opened with this password, because it was saved before a password reset.</p>
        <div className="row">
          <button className="primary" onClick={() => void saveNow()} disabled={busy}>
            Replace it with this device’s info
          </button>
        </div>
      </div>
    )
  } else if (pref.autoSync && reconciled) {
    state = (
      <p className="sync-line">
        <span className="dot ok" aria-hidden /> {syncError ? 'Couldn’t reach the server. It will try again on your next change.' : saving ? 'Saving…' : `Synced${cloudTime ? ` ${when(cloudTime)}` : ''}. Changes sync automatically.`}
      </p>
    )
  } else {
    state = (
      <div className="stack">
        <p className="small">{cloudTime ? `Last saved ${when(cloudTime)}.` : 'Nothing saved yet.'}</p>
        <div className="row">
          <button className="primary" onClick={() => void saveNow()} disabled={busy}>
            {cloudTime ? 'Send this device’s info' : 'Sync now'}
          </button>
          {cloudTime && (
            <button className="secondary" onClick={() => void restore()} disabled={busy}>
              Load my synced info here
            </button>
          )}
        </div>
      </div>
    )
  }

  const syncStep = (
    <div className="stack">
      {state}
      <label className="check">
        <input id="cloud-auto" type="checkbox" checked={pref.autoSync} onChange={(e) => setAuto(e.target.checked)} />
        <span>Sync automatically on this device</span>
      </label>
      {pref.autoSync && reconciled && cloudTime && (
        <div className="row">
          <button className="ghost small-btn" onClick={() => void restore()} disabled={busy}>
            Load synced info again
          </button>
        </div>
      )}
      <div className="row">
        {confirmDelete ? (
          <>
            <button className="danger" onClick={() => void deleteCloud()} disabled={busy}>
              Yes, delete my synced copy
            </button>
            <button className="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          cloudTime && (
            <button className="ghost danger-text small-btn" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Delete my synced copy
            </button>
          )
        )}
      </div>
    </div>
  )

  return (
    <section className="panel cloud">
      <h3>Sync across devices</h3>
      <p>Everything is scrambled on this device with your password before it’s uploaded, so only you can read it.</p>
      <p className="callout">This site is a prototype, so accounts and synced copies may be deleted. Use sync for convenience, and keep your own record of your progress.</p>

      <ol className="steps-ui">
        {step(
          1,
          step1Done ? 'Signed in' : user && recovering ? 'Set a new password' : user ? 'Turn sync back on' : 'Sign in or create an account',
          step1Done ? 'done' : 'active',
          step1,
          step1Done && (
            <button className="ghost small-btn" onClick={() => void signOut()} disabled={busy}>
              Sign out
            </button>
          ),
        )}
        {step(2, 'Sync', step1Done ? 'active' : 'todo', step1Done ? syncStep : null)}
      </ol>

      {message && (
        <p className="notice ok" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice bad" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
