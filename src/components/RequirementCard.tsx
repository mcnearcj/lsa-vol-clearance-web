import { useId, useState } from 'react'
import { standing, standingLabel, todayISO, type Standing } from '../dates'
import { formInfo } from '../data/forms'
import type { ItemProgress, Requirement } from '../types'

interface Props {
  req: Requirement
  progress: ItemProgress | undefined
  onChange: (p: ItemProgress) => void
  /** Scrolls to "Forms to sign", where an item's form is made. */
  onGoToForms: () => void
}

function StatusIcon({ st }: { st: Standing }) {
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

export function RequirementCard({ req, progress, onChange, onGoToForms }: Props) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const cur: ItemProgress = progress ?? { status: 'todo' }
  const { standing: st } = standing(req, progress)
  const isDone = cur.status === 'done'

  const markDone = () => onChange({ ...cur, status: 'done', completedOn: cur.completedOn || todayISO() })
  const undo = () => onChange({ ...cur, status: 'todo', completedOn: undefined })

  const meta = [req.time, req.validYears ? `Renew every ${req.validYears} years` : req.group !== 'driving' ? 'One time' : null].filter(Boolean)

  return (
    <li className={`card st-${st}${open ? ' open' : ''}`}>
      <button className="card-head" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={detailsId}>
        <StatusIcon st={st} />
        <span className="card-title">
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
          <p className="form-pointer">
            The {formInfo(req.form).label} is filled in for you under{' '}
            <button className="link" onClick={onGoToForms}>
              Forms to sign
            </button>
            .
          </p>
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

        <p className="small">Item {req.number} on the diocese’s checklist.</p>

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

