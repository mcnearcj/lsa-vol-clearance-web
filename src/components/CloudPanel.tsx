import { useCallback, useEffect, useRef, useState } from 'react'
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

const when = (iso: string) => new Date(iso).toLocaleString()

export function CloudPanel({ profile, progress, onRestore }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [vault, setVault] = useState<Vault | null>(null)
  const [cloudTime, setCloudTime] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(false)
  // Automatic saving is offered only after an explicit save or restore, so an empty device can't overwrite a good copy.
  const [reconciled, setReconciled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
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

  // Restore an existing sign-in when the panel opens.
  useEffect(() => {
    if (!cloudConfigured) return
    let live = true
    getClient()
      .then((c) => c.auth.getSession())
      .then(({ data }) => live && setUserEmail(data.session?.user.email ?? null))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const fetchRow = async (): Promise<VaultRow | null> => {
    const c = await getClient()
    const { data, error: err } = await c.from('vault').select('salt, iv, ciphertext, updated_at').maybeSingle()
    if (err) throw new Error(err.message)
    return data as VaultRow | null
  }

  const signIn = (create: boolean) =>
    run(async () => {
      const c = await getClient()
      if (create) {
        const { data, error: err } = await c.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
        if (err) throw new Error(err.message)
        if (!data.session) {
          setMessage('Check your email to confirm your account, then sign in.')
          return
        }
        setUserEmail(data.session.user.email ?? email)
      } else {
        const { data, error: err } = await c.auth.signInWithPassword({ email, password })
        if (err) throw new Error(err.message)
        setUserEmail(data.user.email ?? email)
      }
      setPassword('')
    })

  const signOut = () =>
    run(async () => {
      const c = await getClient()
      await c.auth.signOut()
      setUserEmail(null)
      setVault(null)
      setAutoSync(false)
      setReconciled(false)
      setCloudTime(null)
    })

  const unlock = () =>
    run(async () => {
      if (passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.')
      const row = await fetchRow()
      if (row) {
        const key = await deriveKey(passphrase, b64.from(row.salt))
        try {
          await decryptJson<Snapshot>(key, row.iv, row.ciphertext)
        } catch {
          throw new Error('That passphrase does not unlock your saved copy.')
        }
        setVault({ key, salt: row.salt })
        setCloudTime(row.updated_at)
        setMessage('Unlocked. A saved copy exists. Restore it or replace it with what is on this device.')
      } else {
        const salt = newSalt()
        setVault({ key: await deriveKey(passphrase, salt), salt: b64.to(salt) })
        setMessage('Passphrase set. Save to create your cloud copy.')
      }
      setPassphrase('')
    })

  const save = useCallback(
    async (v: Vault) => {
      const c = await getClient()
      const { data: userData } = await c.auth.getUser()
      if (!userData.user) throw new Error('You are signed out. Sign in again.')
      const snapshot: Snapshot = { v: 1, ...latest.current }
      const { iv, ciphertext } = await encryptJson(v.key, snapshot)
      const updated_at = new Date().toISOString()
      const { error: err } = await c
        .from('vault')
        .upsert({ user_id: userData.user.id, salt: v.salt, iv, ciphertext, updated_at })
      if (err) throw new Error(err.message)
      setCloudTime(updated_at)
      setReconciled(true)
    },
    [],
  )

  const saveNow = () =>
    run(async () => {
      if (!vault) return
      await save(vault)
      setMessage('Saved to the cloud, encrypted.')
    })

  const restore = () =>
    run(async () => {
      if (!vault) return
      const row = await fetchRow()
      if (!row) throw new Error('There is no saved copy yet.')
      const data = await decryptJson<Snapshot>(vault.key, row.iv, row.ciphertext)
      onRestore({ profile: data.profile, progress: data.progress })
      setCloudTime(row.updated_at)
      setReconciled(true)
      setMessage('Restored from the cloud.')
    })

  const deleteCloud = () =>
    run(async () => {
      const c = await getClient()
      const { error: err } = await c.from('vault').delete().not('user_id', 'is', null)
      if (err) throw new Error(err.message)
      setCloudTime(null)
      setAutoSync(false)
      setReconciled(false)
      setConfirmDelete(false)
      setMessage('Your cloud copy was deleted. Your data on this device is untouched.')
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
      <section className="about">
        <h2>Cloud backup</h2>
        <p>
          Cloud backup is optional and is not turned on for this site. Your information stays in this browser. Use “Download backup” on the About page to keep a copy or move it to another device.
        </p>
      </section>
    )
  }

  return (
    <section className="about cloud">
      <h2>Cloud backup (optional)</h2>
      <p>
        Keep a copy of your info and progress so you can pick it up on another device. Your data is encrypted in this browser with a passphrase only you know before it is uploaded. The server stores scrambled data it cannot read, and the diocese or site owner cannot read it either.
      </p>
      <p className="callout">If you forget your passphrase, your cloud copy cannot be recovered. Your account password cannot reset it.</p>

      {!userEmail ? (
        <form
          className="grid"
          onSubmit={(e) => {
            e.preventDefault()
            void signIn(false)
          }}
        >
          <label className="field">
            <span>Email</span>
            <input id="cloud-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Account password</span>
            <input
              id="cloud-password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <div className="actions">
            <button className="primary" type="submit" disabled={busy}>
              Sign in
            </button>
            <button type="button" disabled={busy || !email || password.length < 8} onClick={() => void signIn(true)}>
              Create account
            </button>
          </div>
        </form>
      ) : (
        <>
          <p>
            Signed in as <strong>{userEmail}</strong>.{' '}
            <button className="link inline" onClick={() => void signOut()} disabled={busy}>
              Sign out
            </button>
          </p>

          {!vault ? (
            <form
              className="grid"
              onSubmit={(e) => {
                e.preventDefault()
                void unlock()
              }}
            >
              <label className="field">
                <span>Encryption passphrase (not your account password)</span>
                <input
                  id="cloud-passphrase"
                  type="password"
                  autoComplete="off"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </label>
              <div className="actions">
                <button className="primary" type="submit" disabled={busy || !passphrase}>
                  Unlock
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="small">{cloudTime ? `Cloud copy last saved ${when(cloudTime)}.` : 'No cloud copy saved yet.'}</p>
              <div className="actions">
                <button className="primary" onClick={() => void saveNow()} disabled={busy}>
                  Save this device to the cloud
                </button>
                <button onClick={() => void restore()} disabled={busy || !cloudTime}>
                  Restore from the cloud
                </button>
              </div>
              <label className="check">
                <input id="cloud-auto" type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} disabled={!reconciled} />
                <span>Keep the cloud copy up to date automatically while this page is open</span>
              </label>
              <div className="actions">
                {confirmDelete ? (
                  <>
                    <button className="danger" onClick={() => void deleteCloud()} disabled={busy}>
                      Yes, delete my cloud copy
                    </button>
                    <button onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </>
                ) : (
                  <button className="danger" onClick={() => setConfirmDelete(true)} disabled={busy || !cloudTime}>
                    Delete my cloud copy
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {message && <p role="status">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
