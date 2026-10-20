import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cloudConfigured, getClient, type VaultRow } from '../cloud/client'
import { b64, decryptJson, deriveKey, encryptJson, newSalt } from '../cloud/crypto'
import type { Profile, Progress } from '../types'

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

/** Supabase sends people back with details in the URL hash (after confirming email or resetting a password). */
function readAuthHash(): { error?: string; recovery: boolean } {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const code = params.get('error_code')
  const recovery = params.get('type') === 'recovery'
  if (code === 'otp_expired') return { error: 'That email link has expired. Sign in below, or use “Create account” again to get a new link.', recovery }
  const desc = params.get('error_description')
  return { error: desc ? desc.replace(/\+/g, ' ') : undefined, recovery }
}

export function CloudPanel({ profile, progress, onRestore }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [recovering, setRecovering] = useState(() => cloudConfigured && readAuthHash().recovery)
  const [passphrase, setPassphrase] = useState('')
  const [passphrase2, setPassphrase2] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [vault, setVault] = useState<Vault | null>(null)
  const [hasCopy, setHasCopy] = useState<boolean | null>(null)
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

  // Once signed in, find out whether a saved copy already exists so step 2 can say "unlock" or "create".
  useEffect(() => {
    if (!userEmail) return
    let live = true
    fetchRow()
      .then((row) => {
        if (!live) return
        setHasCopy(Boolean(row))
        setCloudTime(row?.updated_at ?? null)
      })
      .catch(() => live && setHasCopy(null))
    return () => {
      live = false
    }
  }, [userEmail, fetchRow])

  const submitAccount = () =>
    run(async () => {
      const c = await getClient()
      if (mode === 'forgot') {
        const { error: err } = await c.auth.resetPasswordForEmail(email, { redirectTo: here() })
        if (err) throw new Error(err.message)
        setMessage('If that email has an account, a reset link is on its way. Open it on this device.')
        return
      }
      if (mode === 'create') {
        const { data, error: err } = await c.auth.signUp({ email, password, options: { emailRedirectTo: here() } })
        if (err) throw new Error(err.message)
        if (!data.session) {
          setMessage(`Almost done. We sent a confirmation link to ${email}. Open it on this device, then come back here.`)
          setMode('signin')
          return
        }
        setUserEmail(data.session.user.email ?? email)
      } else {
        const { data, error: err } = await c.auth.signInWithPassword({ email, password })
        if (err) throw new Error(err.message === 'Invalid login credentials' ? 'That email and password don’t match an account.' : err.message)
        setUserEmail(data.user.email ?? email)
      }
      setPassword('')
    })

  const setPasswordFromLink = () =>
    run(async () => {
      const c = await getClient()
      const { error: err } = await c.auth.updateUser({ password: newPassword })
      if (err) throw new Error(err.message)
      setNewPassword('')
      setRecovering(false)
      setMessage('Password updated. You’re signed in.')
    })

  const signOut = () =>
    run(async () => {
      const c = await getClient()
      await c.auth.signOut()
      setUserEmail(null)
      setVault(null)
      setHasCopy(null)
      setAutoSync(false)
      setReconciled(false)
      setCloudTime(null)
    })

  const unlock = () =>
    run(async () => {
      if (passphrase.length < 8) throw new Error('Your backup passphrase needs at least 8 characters.')
      const row = await fetchRow()
      if (row) {
        const key = await deriveKey(passphrase, b64.from(row.salt))
        try {
          await decryptJson<Snapshot>(key, row.iv, row.ciphertext)
        } catch {
          throw new Error('That passphrase doesn’t open your saved copy. Check for typos and try again.')
        }
        setVault({ key, salt: row.salt })
        setCloudTime(row.updated_at)
        setHasCopy(true)
      } else {
        if (hasCopy === false && passphrase !== passphrase2) throw new Error('The two passphrases don’t match.')
        const salt = newSalt()
        setVault({ key: await deriveKey(passphrase, salt), salt: b64.to(salt) })
        setHasCopy(false)
      }
      setPassphrase('')
      setPassphrase2('')
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
    setHasCopy(true)
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
      setHasCopy(false)
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

  const accountForm = recovering && userEmail ? (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        void setPasswordFromLink()
      }}
    >
      <label className="field">
        <span>New account password</span>
        <input id="cloud-new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <small>At least 8 characters.</small>
      </label>
      <div className="row">
        <button className="primary" type="submit" disabled={busy}>
          Save new password
        </button>
      </div>
    </form>
  ) : (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        void submitAccount()
      }}
    >
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
      {mode !== 'forgot' && (
        <label className="field">
          <span>{mode === 'create' ? 'Choose a password' : 'Password'}</span>
          <input
            id="cloud-password"
            type="password"
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === 'create' && <small>At least 8 characters.</small>}
        </label>
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
    </form>
  )

  const passphraseForm = (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        void unlock()
      }}
    >
      <p>
        {hasCopy
          ? 'Enter the backup passphrase you chose when you first saved.'
          : 'Choose a backup passphrase. It scrambles your info before it leaves this device, so nobody else can read it. It is different from your password.'}
      </p>
      <label className="field">
        <span>Backup passphrase</span>
        <input id="cloud-passphrase" type="password" autoComplete="off" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        {!hasCopy && <small>At least 8 characters. A short sentence works well.</small>}
      </label>
      {hasCopy === false && (
        <label className="field">
          <span>Type it again</span>
          <input id="cloud-passphrase-2" type="password" autoComplete="off" value={passphrase2} onChange={(e) => setPassphrase2(e.target.value)} />
        </label>
      )}
      {!hasCopy && <p className="callout">Write it down somewhere safe. If you lose it, nobody can recover your backup, not even the site owner.</p>}
      <div className="row">
        <button className="primary" type="submit" disabled={busy || !passphrase}>
          {hasCopy ? 'Unlock my backup' : 'Set passphrase'}
        </button>
      </div>
    </form>
  )

  const saveRestore = (
    <div className="stack">
      <p className="small">{cloudTime ? `Last saved ${when(cloudTime)}.` : 'Nothing saved yet.'}</p>
      <div className="row">
        <button className="primary" onClick={() => void saveNow()} disabled={busy}>
          {cloudTime ? 'Save this device’s info' : 'Save my first backup'}
        </button>
        {cloudTime && (
          <button className="secondary" onClick={() => void restore()} disabled={busy}>
            Restore my backup here
          </button>
        )}
      </div>
      {cloudTime && !reconciled && (
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
      <p>Sign in to keep a copy you can open on another phone or computer. Your info is scrambled on this device before it’s uploaded, so only you can read it.</p>

      <ol className="steps-ui">
        {step(
          1,
          userEmail ? 'Signed in' : 'Sign in or create an account',
          userEmail && !recovering ? 'done' : 'active',
          userEmail && !recovering ? <p className="small">{userEmail}</p> : accountForm,
          userEmail && (
            <button className="ghost small-btn" onClick={() => void signOut()} disabled={busy}>
              Sign out
            </button>
          ),
        )}
        {step(
          2,
          vault ? 'Backup unlocked' : hasCopy ? 'Unlock your backup' : 'Set a backup passphrase',
          vault ? 'done' : userEmail && !recovering ? 'active' : 'todo',
          userEmail && !recovering && !vault ? passphraseForm : null,
        )}
        {step(3, 'Save or restore', vault ? 'active' : 'todo', vault ? saveRestore : null)}
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
