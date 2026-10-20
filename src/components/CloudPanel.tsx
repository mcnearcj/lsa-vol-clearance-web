import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cloudConfigured, getClient, type VaultRow } from '../cloud/client'
import { b64, decryptJson, deriveAuthSecret, deriveKey, encryptJson, newSalt } from '../cloud/crypto'
import type { Profile, Progress } from '../types'

// One password does two jobs, both worked out on this device:
//  - a sign-in secret derived from it is what the sign-in service sees (never the password itself)
//  - an encryption key derived from it (with a different, random salt) locks the backup before upload
// So the server can't read backups, and a password reset gets you back in but can't open an old backup.

interface Snapshot {
  v: 1
  profile: Profile
  progress: Progress
}

interface Props {
  profile: Profile
  progress: Progress
  onRestore: (data: { profile: Profile; progress: Progress }) => void
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

export function CloudPanel({ profile, progress, onRestore }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [recovering, setRecovering] = useState(() => cloudConfigured && readAuthHash().recovery)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [vault, setVault] = useState<Vault | null>(null)
  // A backup exists but this password can't open it (made before a password reset, or with the old separate passphrase).
  const [stale, setStale] = useState(false)
  const [cloudTime, setCloudTime] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(false)
  // Automatic saving is offered only after an explicit save or restore, so an empty device can't overwrite a good copy.
  const [reconciled, setReconciled] = useState(false)
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

  // Pick up an existing sign-in, and anything an email link brought back.
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
          setUserEmail(session?.user.email ?? null)
        })
        unsubscribe = () => sub.subscription.unsubscribe()
        const { data } = await c.auth.getSession()
        if (live) setUserEmail(data.session?.user.email ?? null)
        if (hadError && window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search)
      })
      .catch(() => {})
    return () => {
      live = false
      unsubscribe()
    }
  }, [])

  /** Signs in with the derived secret. Accounts made before the one-password change used the raw password; move them over. */
  const signInWith = async (addr: string, pw: string) => {
    const c = await getClient()
    const secret = await deriveAuthSecret(addr, pw)
    const first = await c.auth.signInWithPassword({ email: addr, password: secret })
    if (!first.error) return first.data.user.email ?? addr
    if (first.error.message !== 'Invalid login credentials') throw new Error(first.error.message)
    const legacy = await c.auth.signInWithPassword({ email: addr, password: pw })
    if (legacy.error) throw new Error(legacy.error.message === 'Invalid login credentials' ? WRONG : legacy.error.message)
    const { error: upd } = await c.auth.updateUser({ password: secret })
    if (upd) throw new Error(upd.message)
    return legacy.data.user.email ?? addr
  }

  /** Works out the encryption key from the password and checks it against any saved backup. */
  const unlockWith = async (pw: string) => {
    const row = await fetchRow()
    setCloudTime(row?.updated_at ?? null)
    if (row) {
      const key = await deriveKey(pw, b64.from(row.salt))
      try {
        await decryptJson<Snapshot>(key, row.iv, row.ciphertext)
        setVault({ key, salt: row.salt })
        setStale(false)
        return
      } catch {
        setStale(true)
      }
    } else {
      setStale(false)
    }
    const salt = newSalt()
    setVault({ key: await deriveKey(pw, salt), salt: b64.to(salt) })
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
        setUserEmail(data.session.user.email ?? addr)
      } else {
        setUserEmail(await signInWith(addr, password))
      }
      await unlockWith(password)
      setPassword('')
      setPassword2('')
    })

  // Signed in from an earlier visit or an email link: the password is needed again to open the backup.
  const unlockSession = () =>
    run(async () => {
      if (!userEmail) return
      await signInWith(userEmail, password)
      await unlockWith(password)
      setPassword('')
    })

  const setPasswordFromLink = () =>
    run(async () => {
      if (!userEmail) return
      if (password.length < 8) throw new Error('Your password needs at least 8 characters.')
      if (password !== password2) throw new Error('The two passwords don’t match.')
      const c = await getClient()
      const { error: err } = await c.auth.updateUser({ password: await deriveAuthSecret(userEmail, password) })
      if (err) throw new Error(err.message)
      await unlockWith(password)
      setPassword('')
      setPassword2('')
      setRecovering(false)
      setMessage('Password updated. You’re signed in.')
    })

  const signOut = () =>
    run(async () => {
      const c = await getClient()
      await c.auth.signOut()
      setUserEmail(null)
      setVault(null)
      setStale(false)
      setAutoSync(false)
      setReconciled(false)
      setCloudTime(null)
    })

  const save = useCallback(async (v: Vault) => {
    const c = await getClient()
    const { data: userData } = await c.auth.getUser()
    if (!userData.user) throw new Error('You’ve been signed out. Sign in again to keep saving.')
    const snapshot: Snapshot = { v: 1, ...latest.current }
    const { iv, ciphertext } = await encryptJson(v.key, snapshot)
    const updated_at = new Date().toISOString()
    const { error: err } = await c.from('vault').upsert({ user_id: userData.user.id, salt: v.salt, iv, ciphertext, updated_at })
    if (err) throw new Error(err.message)
    setCloudTime(updated_at)
    setStale(false)
    setReconciled(true)
  }, [])

  const saveNow = () =>
    run(async () => {
      if (!vault) return
      await save(vault)
      setMessage('Saved. Your backup is up to date.')
    })

  const restore = () =>
    run(async () => {
      if (!vault) return
      const row = await fetchRow()
      if (!row) throw new Error('There’s no saved copy yet.')
      const data = await decryptJson<Snapshot>(vault.key, row.iv, row.ciphertext)
      onRestore({ profile: data.profile, progress: data.progress })
      setCloudTime(row.updated_at)
      setReconciled(true)
      setMessage('Restored. Your info and checklist now match your backup.')
    })

  const deleteCloud = () =>
    run(async () => {
      const c = await getClient()
      const { error: err } = await c.from('vault').delete().not('user_id', 'is', null)
      if (err) throw new Error(err.message)
      setCloudTime(null)
      setStale(false)
      setAutoSync(false)
      setReconciled(false)
      setConfirmDelete(false)
      setMessage('Your online backup was deleted. Everything on this device is still here.')
    })

  // Keep the cloud copy current while sync is on. Waits for a pause in edits.
  useEffect(() => {
    if (!autoSync || !vault) return
    const t = setTimeout(() => {
      save(vault).catch((e) => setError(e instanceof Error ? e.message : 'Automatic save failed.'))
    }, 2500)
    return () => clearTimeout(t)
  }, [autoSync, vault, profile, progress, save])

  if (!cloudConfigured) {
    return (
      <section className="panel">
        <h3>Online backup</h3>
        <p>Online backup isn’t turned on for this site. Use a backup file instead.</p>
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
  if (userEmail && recovering) {
    step1 = form(
      () => void setPasswordFromLink(),
      <>
        <p>Choose a new password for {userEmail}.</p>
        {passwordField('New password', 'cloud-new-password', password, setPassword, 'new-password', 'At least 8 characters.')}
        {passwordField('Type it again', 'cloud-new-password-2', password2, setPassword2, 'new-password')}
        <div className="row">
          <button className="primary" type="submit" disabled={busy}>
            Save new password
          </button>
        </div>
      </>,
    )
  } else if (userEmail && !vault) {
    step1 = form(
      () => void unlockSession(),
      <>
        <p>Signed in as {userEmail}. Enter your password to open your backup.</p>
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
  } else if (userEmail) {
    step1 = <p className="small">{userEmail}</p>
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
        {mode === 'create' && (
          <p className="callout">Keep your password somewhere safe. If you reset it later, your old backup can’t be opened, but everything on your device stays and you can save it again.</p>
        )}
        {mode === 'forgot' && (
          <p className="small">After resetting, you’ll be signed back in. Your old backup can’t be opened with a new password, so save again from a device that has your info.</p>
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

  const step1Done = Boolean(userEmail && vault && !recovering)

  const saveRestore = (
    <div className="stack">
      {stale ? (
        <p className="callout">
          You have an older backup that can’t be opened with this password (it was saved before a password reset or with the old separate passphrase). Save this device’s info to replace it.
        </p>
      ) : (
        <p className="small">{cloudTime ? `Last saved ${when(cloudTime)}.` : 'Nothing saved yet.'}</p>
      )}
      <div className="row">
        <button className="primary" onClick={() => void saveNow()} disabled={busy}>
          {stale ? 'Replace it with this device’s info' : cloudTime ? 'Save this device’s info' : 'Save my first backup'}
        </button>
        {cloudTime && !stale && (
          <button className="secondary" onClick={() => void restore()} disabled={busy}>
            Restore my backup here
          </button>
        )}
      </div>
      {cloudTime && !stale && !reconciled && (
        <p className="small">On a new device? Choose “Restore” first, so you don’t overwrite your backup with an empty checklist.</p>
      )}
      <label className="check">
        <input id="cloud-auto" type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} disabled={!reconciled} />
        <span>
          Save changes automatically while this page is open
          {!reconciled && <small> (available after you save or restore once)</small>}
        </span>
      </label>
      <div className="row">
        {confirmDelete ? (
          <>
            <button className="danger" onClick={() => void deleteCloud()} disabled={busy}>
              Yes, delete my online backup
            </button>
            <button className="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          cloudTime && (
            <button className="ghost danger-text" onClick={() => setConfirmDelete(true)} disabled={busy}>
              Delete my online backup
            </button>
          )
        )}
      </div>
    </div>
  )

  return (
    <section className="panel cloud">
      <h3>Online backup</h3>
      <p>Sign in to keep a copy you can open on another phone or computer. Your info is scrambled on this device with your password before it’s uploaded, so only you can read it.</p>

      <ol className="steps-ui">
        {step(
          1,
          step1Done ? 'Signed in' : userEmail && recovering ? 'Set a new password' : userEmail ? 'Open your backup' : 'Sign in or create an account',
          step1Done ? 'done' : 'active',
          step1,
          step1Done && (
            <button className="ghost small-btn" onClick={() => void signOut()} disabled={busy}>
              Sign out
            </button>
          ),
        )}
        {step(2, 'Save or restore', step1Done ? 'active' : 'todo', step1Done ? saveRestore : null)}
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
