import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cloudConfigured, getClient, type VaultRow } from '../cloud/client'
import { b64, decryptJson, deriveAuthSecret, deriveKey, encryptJson, newSalt } from '../cloud/crypto'
import { keystore } from '../cloud/keystore'
import { useStored } from '../storage'
import type { Profile, Progress } from '../types'

// One password does two jobs, both worked out on this device:
//  - a sign-in secret derived from it is what the sign-in service sees (never the password itself)
//  - an encryption key derived from it (with a different, random salt) locks the backup before upload
// So the server can't read backups, and a password reset gets you back in but can't open an old backup.
// Once signed in, backup runs automatically unless the person opted out at their first sign-in on this device.

interface Snapshot {
  v: 1
  profile: Profile
  progress: Progress
}

export type BackupStatus = 'unavailable' | 'signed-out' | 'locked' | 'attention' | 'saving' | 'saved' | 'manual' | 'error'

interface Props {
  profile: Profile
  progress: Progress
  onRestore: (data: { profile: Profile; progress: Progress }) => void
  onStatus?: (status: BackupStatus, savedAt: string | null) => void
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

/** Supabase sends people back with details in the URL hash (after confirming email or resetting a password). */
function readAuthHash(): { error?: string; recovery: boolean } {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const code = params.get('error_code')
  const recovery = params.get('type') === 'recovery'
  if (code === 'otp_expired') return { error: 'That email link has expired. Sign in below, or use “I’m new” again to get a new link.', recovery }
  const desc = params.get('error_description')
  return { error: desc ? desc.replace(/\+/g, ' ') : undefined, recovery }
}

/** JSON with sorted keys, so two copies of the same data compare equal. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== '')
    return `{${entries.sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const isEmpty = (d: { profile: Profile; progress: Progress }) =>
  !d.profile.firstName.trim() && !d.profile.lastName.trim() && Object.keys(d.progress).length === 0

export function CloudPanel({ profile, progress, onRestore, onStatus, resetToken = 0 }: Props) {
  const [pref, setPref] = useStored('cloud', { autoSync: true, decided: false })
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [recovering, setRecovering] = useState(() => cloudConfigured && readAuthHash().recovery)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [vault, setVault] = useState<Vault | null>(null)
  // A backup exists but this password can't open it (made before a password reset, or with the old separate passphrase).
  const [stale, setStale] = useState(false)
  // The backup and this device both have different info; the person chooses which to keep.
  const [conflict, setConflict] = useState<Snapshot | null>(null)
  const [cloudTime, setCloudTime] = useState<string | null>(null)
  // Automatic saving starts only once the backup and this device agree, so an empty device can't overwrite a good copy.
  const [reconciled, setReconciled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(() => (cloudConfigured ? (readAuthHash().error ?? '') : ''))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const latest = useRef({ profile, progress })
  useEffect(() => {
    latest.current = { profile, progress }
  }, [profile, progress])

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

  const save = useCallback(async (v: Vault) => {
    const c = await getClient()
    const { data: userData } = await c.auth.getUser()
    if (!userData.user) throw new Error('You’ve been signed out. Sign in again to keep syncing.')
    const snapshot: Snapshot = { v: 1, ...latest.current }
    const { iv, ciphertext } = await encryptJson(v.key, snapshot)
    const updated_at = new Date().toISOString()
    const { error: err } = await c.from('vault').upsert({ user_id: userData.user.id, salt: v.salt, iv, ciphertext, updated_at })
    if (err) throw new Error(err.message)
    setCloudTime(updated_at)
    setStale(false)
    setConflict(null)
    setReconciled(true)
    setSyncError(false)
  }, [])

  /** Brings the backup and this device into agreement: save, restore, or ask. */
  const reconcile = useCallback(
    async (v: Vault, auto: boolean) => {
      const row = await fetchRow()
      setCloudTime(row?.updated_at ?? null)
      if (!row) {
        if (auto) await save(v)
        return
      }
      let data: Snapshot
      try {
        data = await decryptJson<Snapshot>(v.key, row.iv, row.ciphertext)
      } catch {
        setStale(true)
        return
      }
      setStale(false)
      if (!auto) return
      const local = latest.current
      if (isEmpty(local)) {
        onRestore({ profile: data.profile, progress: data.progress })
        setReconciled(true)
        setMessage('Your synced info was loaded onto this device.')
      } else if (stable({ p: local.profile, g: local.progress }) === stable({ p: data.profile, g: data.progress })) {
        setReconciled(true)
      } else {
        setConflict(data)
      }
    },
    [fetchRow, save, onRestore],
  )

  const forget = useCallback(async (userId?: string) => {
    if (userId) await keystore.remove(userId)
    setVault(null)
    setStale(false)
    setConflict(null)
    setReconciled(false)
    setCloudTime(null)
  }, [])

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
            await reconcile(stored, pref.autoSync).catch(() => setSyncError(true))
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

  // Erasing this device's data signs out of backup here, so the empty device isn't saved over the backup.
  const firstReset = useRef(resetToken)
  useEffect(() => {
    if (resetToken === firstReset.current) return
    firstReset.current = resetToken
    void (async () => {
      await keystore.clear()
      await forget()
      setUser(null)
      setPref({ autoSync: true, decided: false })
      const c = await getClient().catch(() => null)
      await c?.auth.signOut()
    })()
  }, [resetToken, forget, setPref])

  /** Signs in with the derived secret. Accounts made before the one-password change used the raw password; move them over. */
  const signInWith = async (addr: string, pw: string) => {
    const c = await getClient()
    const secret = await deriveAuthSecret(addr, pw)
    const first = await c.auth.signInWithPassword({ email: addr, password: secret })
    if (!first.error) return first.data.user
    if (first.error.message !== 'Invalid login credentials') throw new Error(first.error.message)
    const legacy = await c.auth.signInWithPassword({ email: addr, password: pw })
    if (legacy.error) throw new Error(legacy.error.message === 'Invalid login credentials' ? WRONG : legacy.error.message)
    const { error: upd } = await c.auth.updateUser({ password: secret })
    if (upd) throw new Error(upd.message)
    return legacy.data.user
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
        // Can't open the existing backup with this password; a new key will replace it on the next save.
      }
    }
    if (!v) {
      const salt = newSalt()
      v = { key: await deriveKey(pw, salt), salt: b64.to(salt) }
    }
    await keystore.put(userId, v)
    setVault(v)
    await reconcile(v, auto)
  }

  const submitAccount = () =>
    run(async () => {
      const c = await getClient()
      const addr = email.trim()
      if (mode === 'forgot') {
        const { error: err } = await c.auth.resetPasswordForEmail(addr, { redirectTo: here() })
        if (err) throw new Error(err.message)
        setMessage('If that email has an account, a reset link is on its way. Open it on this device.')
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
          setMessage(`Almost done. We sent a confirmation link to ${addr}. Open it on this device, then sign in here.`)
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
    run(async () => {
      if (!vault) return
      await save(vault)
      setMessage('Synced. Everything is up to date.')
    })

  const restore = (data?: Snapshot) =>
    run(async () => {
      if (!vault) return
      let snap = data
      if (!snap) {
        const row = await fetchRow()
        if (!row) throw new Error('There’s no saved copy yet.')
        snap = await decryptJson<Snapshot>(vault.key, row.iv, row.ciphertext)
        setCloudTime(row.updated_at)
      }
      onRestore({ profile: snap.profile, progress: snap.progress })
      setConflict(null)
      setReconciled(true)
      setMessage('Done. This device now matches your synced copy.')
    })

  const setAuto = (on: boolean) => {
    setPref({ autoSync: on, decided: true })
    if (on && vault && !reconciled) void run(() => reconcile(vault, true))
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
      setPref({ autoSync: false, decided: true })
      setMessage('Your synced copy was deleted and sync is off. Everything on this device is still here.')
    })

  // Keep the backup current while automatic backup is on. Waits for a pause in edits.
  useEffect(() => {
    if (!pref.autoSync || !vault || !reconciled || stale) return
    const t = setTimeout(() => {
      setSaving(true)
      save(vault)
        .catch(() => setSyncError(true))
        .finally(() => setSaving(false))
    }, 2000)
    return () => clearTimeout(t)
  }, [pref.autoSync, vault, reconciled, stale, profile, progress, save])

  // Tell the rest of the site how backup is doing, for the status shown under the header.
  const status: BackupStatus = !cloudConfigured
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
    onStatus?.(status, cloudTime)
  }, [status, cloudTime, onStatus])

  if (!cloudConfigured) {
    return (
      <section className="panel">
        <h3>Sync</h3>
        <p>Sync isn’t turned on for this site. Use a backup file instead.</p>
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
            Save new password
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
            Continue
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
          <p className="callout">Keep your password somewhere safe. If you reset it later, your old synced copy can’t be opened, but everything on your device stays and syncs again.</p>
        )}
        {mode === 'forgot' && (
          <p className="small">After resetting, you’ll be signed back in. Your old synced copy can’t be opened with a new password, so it’s replaced with what’s on this device.</p>
        )}
        <div className="row">
          <button className="primary" type="submit" disabled={busy}>
            {mode === 'create' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
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
          <button className="primary" onClick={() => void restore(conflict)} disabled={busy}>
            Use my synced copy{cloudTime ? ` (saved ${when(cloudTime)})` : ''}
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
        <p>You have an older synced copy that can’t be opened with this password (it was saved before a password reset or with the old separate passphrase).</p>
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

  const backupStep = (
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
        {step(2, 'Sync', step1Done ? 'active' : 'todo', step1Done ? backupStep : null)}
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
