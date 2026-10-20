import '@fontsource-variable/dancing-script'
import { useEffect, useRef, useState } from 'react'
import { fieldLabels, formFields } from '../data/formFields'
import { site } from '../data/site'
import { saveFile } from '../save'
import { isStaleBuildError, STALE_MESSAGE } from '../staleBuild'
import { personName, ssnOnAuthorization, type FormId, type Profile } from '../types'

// Sign every form at once, on screen. The signature and SSN live only in this dialog's memory for one download:
// they're never saved on the device, synced, or sent anywhere.

interface Props {
  open: boolean
  profile: Profile
  onClose: () => void
  onEditInfo: () => void
  /** The forms were downloaded signed. */
  onSigned: (forms: FormId[]) => void
}

const SIGNED_FORMS: FormId[] = ['sexabuse', 'conduct', 'social', 'cpsl', 'bgauth', 'nsor']
const INK = '#14215c'
const SCRIPT_FONT = '"Dancing Script Variable", "Brush Script MT", cursive'

const today = () => {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

const loadBytes = async (file: string) => {
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`)
  if (!res.ok) throw new Error(`Could not load the blank form (${file}). Check your connection and try again.`)
  return new Uint8Array(await res.arrayBuffer())
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error('Could not read the signature.'))), 'image/png'),
  )

/** Copies just the inked area of a canvas (with a little margin), so the signature fills its box on the forms. */
function cropToInk(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = src.getContext('2d')!
  const { width, height } = src
  const data = ctx.getImageData(0, 0, width, height).data
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

export function SignDialog({ open, profile, onClose, onEditInfo, onSigned }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pad = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [typed, setTyped] = useState('')
  const [inked, setInked] = useState(false)
  const [ssn, setSsn] = useState('')
  const [showSsn, setShowSsn] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [withSsn, setWithSsn] = useState(false)
  const who = personName(profile)

  // Wipe the signature and SSN whenever the dialog closes.
  const reset = () => {
    setSsn('')
    setShowSsn(false)
    setAgreed(false)
    setInked(false)
    setError('')
    setDone(null)
    setWithSsn(false)
    setTyped('')
    const c = pad.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
  }

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // Size the drawing pad for sharp lines on high-density screens.
  useEffect(() => {
    if (!open || mode !== 'draw') return
    const c = pad.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    if (c.width !== Math.round(rect.width * ratio)) {
      c.width = Math.round(rect.width * ratio)
      c.height = Math.round(rect.height * ratio)
      setInked(false)
    }
  }, [open, mode])

  const point = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
    const c = pad.current!
    const rect = c.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height }
  }

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, pressure: number, pointerType: string) => {
    const ctx = pad.current!.getContext('2d')!
    const ratio = window.devicePixelRatio || 1
    // A pen (like Apple Pencil) reports pressure; a mouse or finger gets a steady line.
    const width = pointerType === 'pen' && pressure > 0 ? 1.2 + pressure * 3.6 : 2.6
    ctx.strokeStyle = INK
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = width * ratio
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
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of events) {
      const p = point(ev)
      stroke(drawing.current, p, ev.pressure, ev.pointerType)
      drawing.current = p
    }
  }
  const onUp = () => {
    drawing.current = null
  }
  const clearPad = () => {
    const c = pad.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setInked(false)
  }

  const typedName = typed || who
  const ssnDigits = ssn.replace(/\D/g, '')
  const ssnOk = ssnDigits.length === 0 || ssnDigits.length === 9
  const hasSignature = mode === 'draw' ? inked : typedName.trim().length > 1
  const missing = [...new Set(SIGNED_FORMS.flatMap((f) => formFields[f]))].filter((k) => !String(profile[k]).trim()).map((k) => fieldLabels[k] ?? k)

  const signatureImage = async (): Promise<Uint8Array> => {
    if (mode === 'draw') {
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

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const { fillAll } = await import('../pdf/fill')
      const { bytes, filename } = await fillAll(profile, loadBytes, { signature: await signatureImage(), date: today(), ssn: ssnDigits || undefined })
      saveFile(filename, bytes, 'application/pdf')
      onSigned(SIGNED_FORMS)
      setWithSsn(Boolean(ssnDigits))
      setSsn('')
      setDone(filename)
    } catch (e) {
      if (isStaleBuildError(e)) setStale(true)
      else setError(e instanceof Error ? e.message : 'The forms could not be made. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="sign-dialog"
      aria-labelledby="sign-h"
      onClose={() => {
        reset()
        onClose()
      }}
    >
      <div className="sign-head">
        <h2 id="sign-h">Sign all forms</h2>
        <button className="ghost small-btn" onClick={() => dialog.current?.close()} aria-label="Close">
          Close
        </button>
      </div>

      {done ? (
        <div className="stack">
          <p className="notice ok" role="status">
            Downloaded <strong>{done}</strong>: all six forms, signed and dated {today()}.
          </p>
          <ol className="steps">
            <li>Open the file and check every page before you hand it in.</li>
            <li>
              Give it to {site.lsec.name}, {site.schoolName}’s LSEC. The NSOR application (last page) goes to the state; its checklist item says how to send it.
            </li>
            {withSsn && <li>The file contains your Social Security Number. Print it or hand it over in person rather than emailing it as a plain attachment.</li>}
          </ol>
          <div className="row">
            <button className="primary" onClick={() => dialog.current?.close()}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void download()
          }}
        >
          <p>
            Signs and dates all six forms for <strong className="who">{who || 'the info on this device'}</strong> and downloads them as one PDF. Your signature and Social Security Number are used only for this download. They’re never saved or synced.
          </p>

          {missing.length > 0 && (
            <div className="missing" role="alert">
              <p>
                These will be blank: <strong>{missing.join(', ')}</strong>.
              </p>
              <div className="row">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    dialog.current?.close()
                    onEditInfo()
                  }}
                >
                  Add them in My info
                </button>
              </div>
            </div>
          )}

          <fieldset className="sign-section">
            <legend>Social Security Number (optional)</legend>
            <p>
              {ssnOnAuthorization(profile) ? (
                <>
                  Goes on <strong>two forms</strong>: the <strong>NSOR application</strong> (the state requires it) and the{' '}
                  <strong>Background Check Authorization</strong>, which asks employees for it.
                </>
              ) : (
                <>
                  Goes on <strong>one form only</strong>: the <strong>NSOR application</strong>, where the state requires it. It isn’t put on any other form.
                </>
              )}
            </p>
            <p className="small">Leave it blank to write it on the printed form by hand.</p>
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
                onChange={(e) => setSsn(e.target.value.replace(/[^\d-]/g, ''))}
                aria-describedby="ssn-help"
                aria-invalid={!ssnOk}
              />
              <button type="button" className="ghost small-btn" onClick={() => setShowSsn(!showSsn)}>
                {showSsn ? 'Hide' : 'Show'}
              </button>
            </div>
            <small id="ssn-help">{ssnOk ? 'Not saved anywhere. Cleared when you close this window.' : 'Enter all 9 digits, or leave it blank.'}</small>
          </fieldset>

          <fieldset className="sign-section">
            <legend>Your signature</legend>
            <div className="seg" role="group" aria-label="How to sign">
              <button type="button" className={mode === 'draw' ? 'on' : ''} aria-pressed={mode === 'draw'} onClick={() => setMode('draw')}>
                Draw
              </button>
              <button type="button" className={mode === 'type' ? 'on' : ''} aria-pressed={mode === 'type'} onClick={() => setMode('type')}>
                Type
              </button>
            </div>
            {mode === 'draw' ? (
              <>
                <div className="pad-wrap">
                  <canvas
                    ref={pad}
                    className="pad"
                    aria-label="Signature pad: draw your signature with a mouse, finger or stylus"
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
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
          </fieldset>

          <label className="check">
            <input id="sign-agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree this is my signature on these forms, and that the information on them is true and complete to the best of my knowledge.
            </span>
          </label>
          <p className="small">Check with {site.lsec.name} that forms signed on screen are accepted. Some offices still ask for ink.</p>

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
            <button className="primary" type="submit" disabled={busy || !agreed || !hasSignature || !ssnOk}>
              {busy ? 'Making your forms…' : 'Sign and download all forms'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
