import { useId, useState } from 'react'
import { missingFields } from '../data/formFields'
import { formatDate, standing, standingLabel, todayISO, type Standing } from '../dates'
import { saveFile } from '../save'
import type { ItemProgress, Profile, Requirement } from '../types'

interface Props {
  req: Requirement
  progress: ItemProgress | undefined
  profile: Profile
  onChange: (p: ItemProgress) => void
  onEditInfo: () => void
  defaultOpen?: boolean
}

const loadBytes = async (file: string) => {
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`)
  if (!res.ok) throw new Error(`Could not load the blank form (${file}). Check your connection and try again.`)
  return new Uint8Array(await res.arrayBuffer())
}

export function StatusIcon({ st }: { st: Standing }) {
  const common = { width: 26, height: 26, viewBox: '0 0 26 26', 'aria-hidden': true } as const
  switch (st) {
    case 'current':
      return (
        <svg {...common} className="icon ok">
          <circle cx="13" cy="13" r="12" fill="currentColor" />
          <path d="M7.5 13.5l3.5 3.5 7.5-8" fill="none" stroke="var(--on-status)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'expiring':
    case 'expired':
      return (
        <svg {...common} className={`icon ${st === 'expired' ? 'bad' : 'warn'}`}>
          <circle cx="13" cy="13" r="12" fill="currentColor" />
          <path d="M13 7v7.5" stroke="var(--on-status)" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="13" cy="18.5" r="1.5" fill="var(--on-status)" />
        </svg>
      )
    case 'started':
      return (
        <svg {...common} className="icon accent">
          <circle cx="13" cy="13" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13 2a11 11 0 0 1 0 22z" fill="currentColor" />
        </svg>
      )
    case 'na':
      return (
        <svg {...common} className="icon muted">
          <circle cx="13" cy="13" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8.5 13h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg {...common} className="icon muted">
          <circle cx="13" cy="13" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
  }
}

export function RequirementCard({ req, progress, profile, onChange, onEditInfo, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<string[] | null>(null)
  const detailsId = useId()
  const cur: ItemProgress = progress ?? { status: 'todo' }
  const { standing: st, expiresOn } = standing(req, progress)
  const isDone = cur.status === 'done'

  const markDone = () => onChange({ ...cur, status: 'done', completedOn: cur.completedOn || todayISO() })
  const undo = () => onChange({ ...cur, status: 'todo', completedOn: undefined })

  const download = async (force = false) => {
    if (!req.form) return
    const gaps = missingFields(req.form.id, profile)
    if (gaps.length && !force) {
      setMissing(gaps)
      return
    }
    setMissing(null)
    setBusy(true)
    setError('')
    try {
      const { fillForm } = await import('../pdf/fill')
      const { bytes, filename } = await fillForm(req.form.id, profile, loadBytes)
      saveFile(filename, bytes, 'application/pdf')
      if (cur.status === 'todo') onChange({ ...cur, status: 'started' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The form could not be made. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const meta = [req.time, req.validYears ? `Renew every ${req.validYears} years` : req.group !== 'driving' ? 'One time' : null].filter(Boolean)

  return (
    <li className={`card st-${st}${open ? ' open' : ''}`}>
      <button className="card-head" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={detailsId}>
        <StatusIcon st={st} />
        <span className="card-title">
          <span className="eyebrow">Checklist #{req.number}</span>
          <span className="title">{req.title}</span>
          <span className="summary">{req.summary}</span>
          {meta.length > 0 && <span className="meta">{meta.join(' · ')}</span>}
        </span>
        <span className="chev" aria-hidden>
          ›
        </span>
      </button>

      <div className="card-status">
        <span className={`badge ${st}`}>{standingLabel[st]}</span>
        {isDone && (
          <label className="done-date">
            <span>{req.validYears ? 'Completed' : 'Done'}</span>
            <input
              type="date"
              value={cur.completedOn ?? ''}
              max={todayISO()}
              onChange={(e) => onChange({ ...cur, completedOn: e.target.value })}
              aria-label={`Date completed for ${req.title}`}
            />
          </label>
        )}
        {expiresOn && <span className={`renew ${st}`}>{st === 'expired' ? 'Expired' : 'Renew by'} {formatDate(expiresOn)}</span>}
        <span className="spacer" />
        {cur.status === 'na' ? (
          <button className="ghost" onClick={undo}>
            This applies to me
          </button>
        ) : isDone ? (
          <button className="ghost" onClick={undo}>
            Undo
          </button>
        ) : (
          <button className="secondary" onClick={markDone}>
            Mark done
          </button>
        )}
      </div>

      <div className="details" id={detailsId} hidden={!open}>
        {req.note && <p className="callout">{req.note}</p>}

        {req.form && (
          <div className="form-box">
            <div>
              <strong>{req.form.label}</strong>
              <p>Filled in with your info. Print it, then sign and date it by hand.</p>
            </div>
            <button className="primary" onClick={() => void download()} disabled={busy}>
              {busy ? 'Making your form…' : 'Download filled-in form'}
            </button>
            {missing && (
              <div className="missing" role="alert">
                <p>
                  These will be blank on the form: <strong>{missing.join(', ')}</strong>.
                </p>
                <div className="row">
                  <button className="secondary" onClick={onEditInfo}>
                    Add them in My info
                  </button>
                  <button className="ghost" onClick={() => void download(true)}>
                    Download anyway
                  </button>
                </div>
              </div>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <h4>Steps</h4>
        <ol className="steps">
          {req.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        {(req.links.length > 0 || req.references?.length) && (
          <ul className="links">
            {req.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer noopener">
                  {l.label}
                  <span className="ext" aria-label="(opens in a new tab)">
                    ↗
                  </span>
                </a>
              </li>
            ))}
            {req.references?.map((r) => (
              <li key={r.file}>
                <a href={`${import.meta.env.BASE_URL}${r.file}`} target="_blank" rel="noreferrer noopener">
                  {r.label} (PDF)
                  <span className="ext" aria-label="(opens in a new tab)">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="card-foot">
          <label className="notes">
            <span>Your notes</span>
            <textarea
              rows={2}
              placeholder="Receipt or application number, who you gave it to…"
              value={cur.notes ?? ''}
              onChange={(e) => onChange({ ...cur, notes: e.target.value })}
            />
          </label>
          <div className="row">
            {cur.status === 'todo' && (
              <button className="ghost" onClick={() => onChange({ ...cur, status: 'started' })}>
                Mark as started
              </button>
            )}
            {req.optional && cur.status !== 'na' && (
              <button className="ghost" onClick={() => onChange({ ...cur, status: 'na', completedOn: undefined })}>
                Doesn’t apply to me
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

