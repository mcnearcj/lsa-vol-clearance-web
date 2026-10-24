import '@fontsource-variable/dancing-script'
import { useEffect, useRef, useState } from 'react'
import { makeChecklist } from '../checklistDownload'
import { customFields, missingFields, sourcesOf } from '../data/formFields'
import { FORMS, FORM_ORDER } from '../data/forms'
import { assetUrl } from '../content/assets'
import { Rich } from './Rich'
import { site } from '../data/site'
import { formatDate, todayISO, todayUS } from '../dates'
import { ssnAsTyped } from '../ssn'
import { isStaleBuildError, STALE_MESSAGE } from '../staleBuild'
import { personName, ssnOnAuthorization, type FormId, type ItemProgress, type Profile, type Progress } from '../types'

/** The forms the site fills in. Forms that are only printed aren't part of a download. */
const fillable = () => FORM_ORDER.filter((id) => FORMS.find((f) => f.id === id)?.kind !== 'download')

// The six forms are filled in automatically, so they're handled together here instead of as checklist items:
// pick the forms (and the submission checklist), optionally sign on screen and add an SSN, then open or download
// the files. The signature and SSN live only in this component's memory; nothing downloads until the person clicks.

interface Props {
  profile: Profile
  progress: Progress
  onFormsProgress: (p: ItemProgress) => void
  onEditInfo: () => void
}

interface ReadyFile {
  title: string
  note: string
  filename: string
  url: string
}

const INK = '#14215c'
const SCRIPT_FONT = '"Dancing Script Variable", "Brush Script MT", cursive'


const loadBytes = async (file: string) => {
  const res = await fetch(assetUrl(file))
  if (!res.ok) throw new Error(`Could not load the blank form (${file}). Check your connection and try again.`)
  return new Uint8Array(await res.arrayBuffer())
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error('Could not read the signature.'))), 'image/png'),
  )

/** Copies just the inked area of a canvas (with a little margin), so the signature fills its box on the forms. */
function cropToInk(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const { width, height } = src
  const data = src.getContext('2d')!.getImageData(0, 0, width, height).data
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  if (maxX < 0) return null
  const pad = 6
  const out = document.createElement('canvas')
  out.width = maxX - minX + 1 + pad * 2
  out.height = maxY - minY + 1 + pad * 2
  out.getContext('2d')!.drawImage(src, minX - pad, minY - pad, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

export function FormsPanel({ profile, progress, onFormsProgress, onEditInfo }: Props) {
  // Nothing is picked to start with: people choose the forms they need, or Select all.
  const [picked, setChosen] = useState<FormId[]>([])
  const everything = fillable()
  // The editor's preview can remove a form while the page is open: ignore choices for forms that are gone.
  const chosen = picked.filter((id) => everything.includes(id))
  const [sensitive, setSensitive] = useState<Record<string, string>>({})
  const [withChecklist, setWithChecklist] = useState(false)
  const [how, setHow] = useState<'paper' | 'screen'>('paper')
  const [sigMode, setSigMode] = useState<'draw' | 'type'>('draw')
  const [typed, setTyped] = useState('')
  const [inked, setInked] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [ssn, setSsn] = useState('')
  const [showSsn, setShowSsn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [files, setFiles] = useState<ReadyFile[]>([])
  const [madeWithSsn, setMadeWithSsn] = useState(false)
  const [madeMissing, setMadeMissing] = useState<string[]>([])
  // Whether the person opened or downloaded a copy (those live outside this page), and whether they just deleted.
  const [copiedOut, setCopiedOut] = useState(false)
  const [deleted, setDeleted] = useState<null | { copiedOut: boolean }>(null)
  const pad = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const urls = useRef<string[]>([])
  const who = personName(profile)
  const formsState = progress.forms

  // Release the generated files (one may contain the SSN) when they're replaced, cleared, or the page closes.
  const releaseFiles = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u))
    urls.current = []
    setFiles([])
    setMadeWithSsn(false)
    setMadeMissing([])
    setCopiedOut(false)
    setDeleted(null)
  }
  const deleteFiles = () => {
    const hadCopies = copiedOut
    releaseFiles()
    setDeleted({ copiedOut: hadCopies })
  }
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  // Size the drawing pad for sharp lines on high-density screens.
  useEffect(() => {
    if (how !== 'screen' || sigMode !== 'draw') return
    const c = pad.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    if (c.width !== Math.round(rect.width * ratio)) {
      c.width = Math.round(rect.width * ratio)
      c.height = Math.round(rect.height * ratio)
      setInked(false)
    }
  }, [how, sigMode])

  const point = (e: { clientX: number; clientY: number }) => {
    const c = pad.current!
    const rect = c.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height }
  }
  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, pressure: number, pointerType: string) => {
    const ctx = pad.current!.getContext('2d')!
    // A pen (like Apple Pencil) reports pressure; a mouse or finger gets a steady line.
    const width = pointerType === 'pen' && pressure > 0 ? 1.2 + pressure * 3.6 : 2.6
    ctx.strokeStyle = INK
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = width * (window.devicePixelRatio || 1)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = point(e)
    drawing.current = p
    stroke(p, { x: p.x + 0.1, y: p.y + 0.1 }, e.pressure, e.pointerType)
    setInked(true)
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
      const p = point(ev)
      stroke(drawing.current, p, ev.pressure, ev.pointerType)
      drawing.current = p
    }
  }
  const clearPad = () => {
    const c = pad.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setInked(false)
  }

  const typedName = typed || who
  // Changing what's chosen clears files made from the old choices, so the links always match the boxes.
  const toggle = (id: FormId) => {
    releaseFiles()
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : fillable().filter((f) => f === id || c.includes(f))))
  }
  const allSelected = everything.length > 0 && everything.every((id) => chosen.includes(id)) && withChecklist
  const selectAll = () => {
    releaseFiles()
    setChosen(allSelected ? [] : everything)
    setWithChecklist(!allSelected)
  }
  const chooseHow = (h: 'paper' | 'screen') => {
    releaseFiles()
    setHow(h)
  }
  const chosenForms = FORMS.filter((f) => chosen.includes(f.id))
  const ssnForms = [
    chosen.includes('nsor') && 'NSOR application',
    chosen.includes('bgauth') && ssnOnAuthorization(profile) && 'Background Check Authorization',
    ...chosenForms.filter((f) => sourcesOf(f).some((src) => src.kind === 'ssn')).map((f) => f.label),
  ].filter(Boolean) as string[]
  // Extra details the school marked "sensitive": asked here, used for these files only, never saved.
  const askedHere = customFields.filter((c) => c.sensitive && chosenForms.some((f) => sourcesOf(f).some((src) => src.kind === 'field' && src.field === c.id)))
  const ssnDigits = ssn.replace(/\D/g, '')
  const ssnOk = ssnDigits.length === 0 || ssnDigits.length === 9
  const hasSignature = sigMode === 'draw' ? inked : typedName.trim().length > 1
  const missing = missingFields(chosen, profile)
  const nothingChosen = chosen.length === 0 && !withChecklist
  const ready = !nothingChosen && ssnOk && (how === 'paper' || chosen.length === 0 || (agreed && hasSignature))

  const signatureImage = async (): Promise<Uint8Array> => {
    if (sigMode === 'draw') {
      const cropped = cropToInk(pad.current!)
      if (!cropped) throw new Error('Draw your signature first.')
      return toPng(cropped)
    }
    await document.fonts.load(`72px ${SCRIPT_FONT}`)
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')!
    ctx.font = `72px ${SCRIPT_FONT}`
    c.width = Math.ceil(ctx.measureText(typedName).width) + 24
    c.height = 110
    ctx.font = `72px ${SCRIPT_FONT}`
    ctx.fillStyle = INK
    ctx.textBaseline = 'middle'
    ctx.fillText(typedName, 12, 58)
    return toPng(cropToInk(c) ?? c)
  }

  const prepare = async () => {
    setBusy(true)
    setError('')
    releaseFiles()
    try {
      const made: ReadyFile[] = []
      const signedOn = how === 'screen' && chosen.length ? todayUS() : undefined
      const asUrl = (bytes: Uint8Array) => {
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
        urls.current.push(url)
        return url
      }
      if (chosen.length) {
        const { fillAll } = await import('../pdf/fill')
        const signed = signedOn ? { signature: await signatureImage(), date: signedOn } : undefined
        const ssnUsed = ssnForms.length > 0 && ssnDigits ? ssnDigits : undefined
        const { bytes, filename } = await fillAll(profile, loadBytes, { signed, ssn: ssnUsed, sensitive }, chosen)
        made.push({
          title: 'Forms to hand in',
          note: `${chosen.length} ${chosen.length === 1 ? 'form' : 'forms'}, ${signedOn ? `signed and dated ${signedOn}` : 'ready to print, sign and date'}`,
          filename,
          url: asUrl(bytes),
        })
        setMadeWithSsn(Boolean(ssnUsed))
        setMadeMissing(missing)
      }
      if (withChecklist) {
        const { bytes, filename } = await makeChecklist(profile, progress, { forms: chosen, signedOn })
        made.push({ title: 'Your submission checklist', note: 'For you to keep. Don’t hand it in.', filename, url: asUrl(bytes) })
      }
      setFiles(made)
      setSsn('')
      setSensitive({})
    } catch (e) {
      if (isStaleBuildError(e)) setStale(true)
      else setError(e instanceof Error ? e.message : 'The files could not be made. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handedIn = formsState?.status === 'done'

  return (
    <div className="forms-panel" id="forms">
      <fieldset className="pick">
        <legend>Choose what you need</legend>
        <div className="row">
          <button type="button" className="ghost small-btn" onClick={selectAll}>
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <ul>
          {FORMS.filter((f) => f.kind !== 'download').map(({ id, label, policy, note, sourceUrl }) => {
            return (
              <li key={id}>
                <label className="check">
                  <input id={`form-${id}`} type="checkbox" checked={chosen.includes(id)} onChange={() => toggle(id)} />
                  <span>
                    {label}
                    {note && (
                      <small>
                        <Rich text={note} inline />
                      </small>
                    )}
                  </span>
                </label>
                {policy && (
                  <a href={policy} target="_blank" rel="noreferrer noopener">
                    Read the policy<span className="ext" aria-label="(opens in a new tab)">↗</span>
                  </a>
                )}
                {!policy && sourceUrl && (
                  <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
                    Official source<span className="ext" aria-label="(opens in a new tab)">↗</span>
                  </a>
                )}
              </li>
            )
          })}
          <li className="checklist-pick">
            <label className="check">
              <input id="form-checklist" type="checkbox" checked={withChecklist} onChange={(e) => {
                  releaseFiles()
                  setWithChecklist(e.target.checked)
                }} />
              <span>
                My submission checklist
                <small>Lists the certificates and results to turn in with your forms. It’s just for you to keep.</small>
              </span>
            </label>
          </li>
        </ul>
      </fieldset>

      {FORMS.some((f) => f.kind === 'download') && (
        <fieldset className="pick">
          <legend>Also needed: print and fill in by hand</legend>
          <ul>
            {FORMS.filter((f) => f.kind === 'download').map((f) => (
              <li key={f.id}>
                <span>
                  {f.label}
                  {f.note && (
                    <small>
                      <Rich text={f.note} inline />
                    </small>
                  )}
                </span>
                <a href={f.file ? assetUrl(f.file) : f.sourceUrl} target="_blank" rel="noreferrer noopener">
                  Open the form<span className="ext" aria-label="(opens in a new tab)">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {chosen.length > 0 && missing.length > 0 && (
        <div className="missing" role="alert">
          <p>
            These will be blank on the forms: <strong>{missing.join(', ')}</strong>.
          </p>
          <div className="row">
            <button type="button" className="secondary" onClick={onEditInfo}>
              Add them in My info
            </button>
          </div>
        </div>
      )}

      {chosen.length > 0 && (
        <fieldset className="pick">
          <legend>How do you want to sign?</legend>
          <div className="seg" role="group" aria-label="How to sign">
            <button type="button" className={how === 'paper' ? 'on' : ''} aria-pressed={how === 'paper'} onClick={() => chooseHow('paper')}>
              Print and sign by hand
            </button>
            <button type="button" className={how === 'screen' ? 'on' : ''} aria-pressed={how === 'screen'} onClick={() => chooseHow('screen')}>
              Sign on screen
            </button>
          </div>
          {how === 'screen' && (
            <div className="stack">
              <div className="seg small-seg" role="group" aria-label="Signature style">
                <button type="button" className={sigMode === 'draw' ? 'on' : ''} aria-pressed={sigMode === 'draw'} onClick={() => setSigMode('draw')}>
                  Draw
                </button>
                <button type="button" className={sigMode === 'type' ? 'on' : ''} aria-pressed={sigMode === 'type'} onClick={() => setSigMode('type')}>
                  Type
                </button>
              </div>
              {sigMode === 'draw' ? (
                <>
                  <div className="pad-wrap">
                    <canvas
                      ref={pad}
                      className="pad"
                      aria-label="Signature pad: draw your signature with a mouse, finger or stylus"
                      onPointerDown={onDown}
                      onPointerMove={onMove}
                      onPointerUp={() => (drawing.current = null)}
                      onPointerCancel={() => (drawing.current = null)}
                    />
                    <span className="pad-line" aria-hidden />
                    {!inked && <span className="pad-hint">Sign here with your mouse, finger or stylus</span>}
                  </div>
                  <div className="row">
                    <button type="button" className="ghost small-btn" onClick={clearPad} disabled={!inked}>
                      Clear
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Type your full name</span>
                    <input id="sign-typed" value={typedName} onChange={(e) => setTyped(e.target.value)} autoComplete="name" />
                  </label>
                  <p className="typed-preview" aria-label="Signature preview" style={{ fontFamily: SCRIPT_FONT }}>
                    {typedName || ' '}
                  </p>
                </>
              )}
              <label className="check">
                <input id="sign-agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>I agree this is my signature on these forms, and that the information on them is true and complete to the best of my knowledge.</span>
              </label>
              <p className="small">Check with {site.lsec.name} that forms signed on screen are accepted. Some offices still ask for ink.</p>
            </div>
          )}
        </fieldset>
      )}

      {ssnForms.length > 0 && (
        <fieldset className="pick">
          <legend>Social Security Number (optional)</legend>
          <p>
            Goes on {ssnForms.length === 1 ? 'one form only' : 'two forms'}: <strong>{ssnForms.join(' and ')}</strong>
            {ssnForms.includes('NSOR application') ? ', where the state requires it' : ''}. Leave it blank to write it on the printed form by hand.
          </p>
          <div className="ssn-row">
            <input
              id="sign-ssn"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              maxLength={11}
              placeholder="123-45-6789"
              className={showSsn ? '' : 'masked'}
              value={ssn}
              onChange={(e) => setSsn(ssnAsTyped(e.target.value))}
              aria-describedby="ssn-help"
              aria-invalid={!ssnOk}
            />
            <button type="button" className="ghost small-btn" onClick={() => setShowSsn(!showSsn)}>
              {showSsn ? 'Hide' : 'Show'}
            </button>
          </div>
          <small id="ssn-help">{ssnOk ? 'Never saved. Used only for the files you make below.' : 'Enter all 9 digits, or leave it blank.'}</small>
        </fieldset>
      )}

      {askedHere.length > 0 && (
        <fieldset className="pick">
          <legend>More details for these forms</legend>
          <p>Used for the files you make below only. Never saved.</p>
          {askedHere.map((f) => (
            <label className="field" key={f.id}>
              <span>{f.label}</span>
              <input
                type={f.type === 'date' ? 'date' : 'text'}
                autoComplete="off"
                value={sensitive[f.id] ?? ''}
                onChange={(e) => setSensitive({ ...sensitive, [f.id]: e.target.value })}
              />
              {f.help && (
                <small>
                  <Rich text={f.help} inline />
                </small>
              )}
            </label>
          ))}
        </fieldset>
      )}

      {stale && (
        <div className="missing" role="alert">
          <p>{STALE_MESSAGE}</p>
          <div className="row">
            <button type="button" className="primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="row">
        <button className="primary" onClick={() => void prepare()} disabled={busy || !ready}>
          {busy ? 'Generating your documents…' : files.length ? 'Generate them again' : 'Generate my documents'}
        </button>
        {nothingChosen && <span className="small">Choose at least one item.</span>}
      </div>

      {files.length > 0 && (
        <div className="ready" role="status">
          <h4>Your documents are ready</h4>
          {madeMissing.length > 0 && (
            <div className="missing" role="alert">
              <p>
                Some info was missing, so these are blank on your forms: <strong>{madeMissing.join(', ')}</strong>. Write them in by hand, or add them in My info and generate your documents again.
              </p>
              <div className="row">
                <button type="button" className="secondary" onClick={onEditInfo}>
                  Add them in My info
                </button>
              </div>
            </div>
          )}
          <p className="small">
            They’re held only in this browser tab’s memory. Nothing was uploaded or saved. They’re erased when you delete them below, change your choices, or close this page.
          </p>
          <ul>
            {files.map((f) => (
              <li key={f.url}>
                <div>
                  <strong>{f.title}</strong>
                  <small>{f.note}</small>
                </div>
                <div className="row">
                  <a className="secondary" href={f.url} target="_blank" rel="noopener" onClick={() => setCopiedOut(true)}>
                    Open
                  </a>
                  <a className="ghost" href={f.url} download={f.filename} onClick={() => setCopiedOut(true)}>
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {madeWithSsn && <p className="small">The forms file contains your Social Security Number. Print it or hand it over in person rather than emailing it as a plain attachment.</p>}
          <p className="small">Check every page before you hand anything in.</p>
          <div className="row">
            <button className="danger" onClick={deleteFiles}>
              Delete these files now
            </button>
          </div>
          <p className="small">
            A downloaded copy is saved on your device, usually in your Downloads folder, and an opened copy stays in its tab until you close it. On a shared computer, delete those too.
          </p>
        </div>
      )}

      {deleted && (
        <p className="notice ok" role="status">
          Deleted. The files are no longer in this page’s memory.
          {deleted.copiedOut && ' You opened or downloaded a copy: close that tab, and if this computer is shared, delete the file from your Downloads folder.'}
        </p>
      )}

      <label className="check handed-in">
        <input
          id="forms-handed-in"
          type="checkbox"
          checked={handedIn}
          onChange={(e) => onFormsProgress(e.target.checked ? { status: 'done', completedOn: todayISO() } : { status: 'todo' })}
        />
        <span>
          I’ve handed in my signed forms
          {handedIn && formsState?.completedOn && <small> on {formatDate(formsState.completedOn)}</small>}
        </span>
      </label>
    </div>
  )
}
