import { useState } from 'react'
import { formatDate, standing, standingLabel, todayISO } from '../dates'
import type { ItemProgress, Profile, Requirement, Status } from '../types'

interface Props {
  req: Requirement
  progress: ItemProgress | undefined
  profile: Profile
  onChange: (p: ItemProgress) => void
  onNeedProfile: () => void
}

const loadBytes = async (file: string) => {
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`)
  if (!res.ok) throw new Error(`Could not load ${file}`)
  return new Uint8Array(await res.arrayBuffer())
}

function download(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function RequirementCard({ req, progress, profile, onChange, onNeedProfile }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cur = progress ?? { status: 'todo' as Status }
  const { standing: st, expiresOn } = standing(req, progress)
  const hasProfile = Boolean(profile.firstName.trim() && profile.lastName.trim())

  const setStatus = (status: Status) => {
    const next: ItemProgress = { ...cur, status }
    if (status === 'done' && !next.completedOn) next.completedOn = todayISO()
    onChange(next)
  }

  const generate = async () => {
    if (!req.form) return
    if (!hasProfile) return onNeedProfile()
    setBusy(true)
    setError('')
    try {
      const { fillForm } = await import('../pdf/fill')
      const { bytes, filename } = await fillForm(req.form.id, profile, loadBytes)
      download(bytes, filename)
      if (cur.status === 'todo') onChange({ ...cur, status: 'started' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong making the PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`card standing-${st}`}>
      <div className="card-head">
        <span className="num" aria-hidden>
          {req.number}
        </span>
        <div className="card-title">
          <h3>
            {req.title}
            {req.optional && <span className="tag">If driving</span>}
          </h3>
          <p>{req.summary}</p>
        </div>
        <span className={`badge ${st}`}>{standingLabel[st]}</span>
      </div>

      <div className="card-controls">
        <label>
          <span className="sr">Status</span>
          <select value={cur.status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="todo">Not started</option>
            <option value="started">In progress</option>
            <option value="done">Complete</option>
            {req.optional && <option value="na">Not applicable</option>}
          </select>
        </label>
        {cur.status === 'done' && (
          <label className="date">
            <span>{req.validYears ? 'Completed on' : 'Date signed / completed'}</span>
            <input type="date" value={cur.completedOn ?? ''} onChange={(e) => onChange({ ...cur, completedOn: e.target.value })} />
          </label>
        )}
        {expiresOn && (
          <span className="expires">
            {st === 'expired' ? 'Expired' : 'Renew by'} {formatDate(expiresOn)}
          </span>
        )}
        <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide steps' : 'Show steps'}
        </button>
      </div>

      {open && (
        <div className="details">
          {req.note && <p className="callout">{req.note}</p>}
          <ol>
            {req.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="actions">
            {req.form && (
              <button className="primary" onClick={generate} disabled={busy}>
                {busy ? 'Making PDF…' : `Fill in & download: ${req.form.label}`}
              </button>
            )}
            {req.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer noopener">
                {l.label} ↗
              </a>
            ))}
            {req.references?.map((r) => (
              <a key={r.file} href={`${import.meta.env.BASE_URL}${r.file}`} target="_blank" rel="noreferrer noopener">
                {r.label} (PDF) ↗
              </a>
            ))}
          </div>
          {req.form && !hasProfile && <p className="hint">Add your name under “My info” first so the form can be filled in.</p>}
          {error && <p className="error">{error}</p>}
          <label className="notes">
            <span>Notes (receipt number, who you gave it to…)</span>
            <textarea rows={2} value={cur.notes ?? ''} onChange={(e) => onChange({ ...cur, notes: e.target.value })} />
          </label>
        </div>
      )}
    </li>
  )
}
