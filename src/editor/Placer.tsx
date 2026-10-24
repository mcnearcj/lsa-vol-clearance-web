import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormInfo } from '../data/forms'
import type { Placement } from '../content/schema'
import { labelOfField } from '../data/formFields'
import { useEd, useLoadFile } from './context'
import { PageCanvas, PdfPages } from './PdfPreview'
import { openPdf, type PdfDoc } from './pdfjs'
import { previewForm } from './sample'
import { decodeSource, encodeSource, sourceOptions } from './sources'
import { Btn, Check, Field, Select, TextInput } from './ui'

const KNOWN_VALUES: Record<string, string[]> = {
  locationType: ['Parish', 'School', 'Both'],
  position: ['Contractor', 'Employee', 'Priest', 'Religious', 'Teacher', 'Volunteer'],
  gender: ['Female', 'Male'],
  residedInPA: ['yes', 'no'],
}

type Rect = { x: number; y: number; w: number; h: number }
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = (typeof HANDLES)[number]

/** What the pointer is doing: drawing a new box, moving one, or dragging one of its handles. */
type Gesture =
  | { mode: 'new'; x0: number; y0: number; x1: number; y1: number }
  | { mode: 'move' | 'resize'; idx: number; handle?: Handle; startX: number; startY: number; orig: Rect }

const round = (n: number) => Math.round(n * 10) / 10
const MIN = 4

function describe(p: Placement): string {
  const src = p.source
  const what =
    p.mark === 'x' ? 'X mark' : p.mark === 'dot' ? 'Filled dot' : src.kind === 'field' ? labelOfField(src.field) : src.kind === 'text' ? `“${src.text || '…'}”` : src.kind === 'ssn' ? 'SSN' : src.kind === 'name' ? 'Full name' : src.kind === 'date' ? 'Date' : 'Signature'
  return p.when ? `${what} if ${labelOfField(p.when.field)} = ${p.when.equals}` : what
}

/** Shows a PDF page and lets the person draw, move and resize boxes where answers belong, and say what goes in each. */
export function Placer({ form, bytes }: { form: FormInfo; bytes: Uint8Array }) {
  const { content, update } = useEd()
  const loadFile = useLoadFile()
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  // The box being moved or resized, shown live; it's written to the settings when the mouse is released.
  const [live, setLive] = useState<{ idx: number; rect: Rect } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(1.2) // pixels per PDF point, chosen so the page fits the space available
  const [preview, setPreview] = useState<Uint8Array | null>(null)
  const [signed, setSigned] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const overlay = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const placements = form.placements ?? []

  useEffect(() => {
    let live = true
    void openPdf(bytes).then((d) => live && setDoc(d))
    return () => {
      live = false
    }
  }, [bytes])

  useEffect(() => {
    if (!doc || !holder.current) return
    const el = holder.current
    let alive = true
    const fit = async () => {
      const pt = (await doc.getPage(page + 1)).getViewport({ scale: 1 }).width
      if (alive && el.clientWidth > 0) setScale(Math.max(0.7, Math.min(1.8, (el.clientWidth - 4) / pt)))
    }
    void fit()
    const ro = new ResizeObserver(() => void fit())
    ro.observe(el)
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [doc, page])
  const onSize = useCallback((w: number, h: number) => setSize({ w, h }), [])

  const edit = (i: number, patch: Partial<Placement>) =>
    update((d) => {
      Object.assign(d.forms.find((x) => x.id === form.id)!.placements![i], patch)
    })
  const remove = (i: number) => {
    update((d) => {
      const f = d.forms.find((x) => x.id === form.id)!
      f.placements = f.placements!.filter((_, j) => j !== i)
    })
    setSel(null)
  }

  const local = (e: React.PointerEvent) => {
    const r = overlay.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(size.w, e.clientX - r.left)), y: Math.max(0, Math.min(size.h, e.clientY - r.top)) }
  }
  const pageW = size.w / scale
  const pageH = size.h / scale
  const clampRect = (r: Rect): Rect => {
    const w = Math.max(MIN, Math.min(pageW, r.w))
    const h = Math.max(MIN, Math.min(pageH, r.h))
    return { x: Math.max(0, Math.min(pageW - w, r.x)), y: Math.max(0, Math.min(pageH - h, r.y)), w, h }
  }

  const down = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement
    const p = local(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    if (t.dataset.handle) {
      const idx = Number(t.dataset.idx)
      setSel(idx)
      setGesture({ mode: 'resize', idx, handle: t.dataset.handle as Handle, startX: p.x, startY: p.y, orig: { ...rectOf(placements[idx]) } })
    } else if (t.dataset.idx) {
      const idx = Number(t.dataset.idx)
      setSel(idx)
      setGesture({ mode: 'move', idx, startX: p.x, startY: p.y, orig: { ...rectOf(placements[idx]) } })
    } else {
      setSel(null)
      setGesture({ mode: 'new', x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    }
  }

  const rectAt = (g: Gesture & { mode: 'move' | 'resize' }, p: { x: number; y: number }): Rect => {
    const dx = (p.x - g.startX) / scale
    const dy = (p.y - g.startY) / scale
    const o = g.orig
    if (g.mode === 'move') return clampRect({ ...o, x: o.x + dx, y: o.y + dy })
    let { x, y, w, h } = o
    const hd = g.handle!
    if (hd.includes('e')) w = o.w + dx
    if (hd.includes('s')) h = o.h + dy
    if (hd.includes('w')) {
      w = o.w - dx
      x = o.x + dx
    }
    if (hd.includes('n')) {
      h = o.h - dy
      y = o.y + dy
    }
    // Dragging a handle past the opposite edge stops at the minimum size instead of flipping.
    if (w < MIN) {
      if (hd.includes('w')) x = o.x + o.w - MIN
      w = MIN
    }
    if (h < MIN) {
      if (hd.includes('n')) y = o.y + o.h - MIN
      h = MIN
    }
    return clampRect({ x, y, w, h })
  }

  const move = (e: React.PointerEvent) => {
    if (!gesture) return
    const p = local(e)
    if (gesture.mode === 'new') setGesture({ ...gesture, x1: p.x, y1: p.y })
    else setLive({ idx: gesture.idx, rect: rectAt(gesture, p) })
  }

  const up = (e: React.PointerEvent) => {
    if (!gesture) return
    const p = local(e) // the end point comes from the release itself, so a quick drag with few move events still counts
    const g = gesture
    setGesture(null)
    setLive(null)
    if (g.mode === 'new') {
      const x = Math.min(g.x0, p.x)
      const y = Math.min(g.y0, p.y)
      const w = Math.abs(p.x - g.x0)
      const h = Math.abs(p.y - g.y0)
      if (w < 8 || h < 5) return
      const added: Placement = { page, x: round(x / scale), y: round(y / scale), w: round(w / scale), h: round(h / scale), source: { kind: 'field', field: 'firstName' } }
      update((d) => {
        const f = d.forms.find((v) => v.id === form.id)!
        f.placements = [...(f.placements ?? []), added]
      })
      setSel(placements.length)
      return
    }
    const r = rectAt(g, p)
    if (round(r.x) !== round(g.orig.x) || round(r.y) !== round(g.orig.y) || round(r.w) !== round(g.orig.w) || round(r.h) !== round(g.orig.h)) edit(g.idx, { x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) })
  }

  const runPreview = async () => {
    setBusy(true)
    setError('')
    try {
      setPreview(await previewForm(content, form.id, loadFile, signed))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The preview could not be made.')
    } finally {
      setBusy(false)
    }
  }

  const cur = sel !== null ? placements[sel] : undefined
  const valueChoices = (field: string): string[] | null => {
    if (KNOWN_VALUES[field]) return KNOWN_VALUES[field]
    const f = content.fields.find((x) => x.id === field)
    if (f?.type === 'yesno') return ['Yes', 'No']
    return f?.type === 'choice' ? (f.options ?? null) : null
  }
  const kindOf = (p: Placement) => (p.mark === 'x' ? 'x' : p.mark === 'dot' ? 'dot' : p.source.kind === 'signature' ? 'signature' : 'text')

  if (preview)
    return (
      <div>
        <div className="ed-row">
          <Btn onClick={() => setPreview(null)}>Back to placing boxes</Btn>
          <span>This is the form filled with made-up details.</span>
        </div>
        <PdfPages bytes={preview} />
      </div>
    )

  return (
    <div className="ed-placer">
      <p className="ed-hint">
        <strong>Drag on the page to draw a box</strong> over each line or spot where something should go. <strong>Drag a box to move it</strong>, or <strong>drag its edges and corners to resize it</strong>. The label shows what goes in it.
        For a check box or a circle to fill in, draw a small box over it and choose “X mark” or “Filled dot”.
      </p>
      <div className="ed-placer-body">
        <div className="ed-canvas-col" ref={holder}>
          <div className="ed-row">
            {doc && doc.numPages > 1 && <Select value={String(page)} onChange={(v) => { setPage(Number(v)); setSel(null) }} options={Array.from({ length: doc.numPages }, (_, i) => [String(i), `Page ${i + 1} of ${doc.numPages}`])} />}
            <Check label="Preview as if signed on screen" checked={signed} onChange={setSigned} />
            <Btn kind="primary" onClick={() => void runPreview()} disabled={busy || placements.length === 0}>{busy ? 'Making preview…' : 'Preview with sample information'}</Btn>
          </div>
          {error && <p className="ed-error" role="alert">{error}</p>}
          <div className="ed-canvas-wrap" style={{ width: size.w || undefined }}>
            {doc ? <PageCanvas doc={doc} page={page} scale={scale} onSize={onSize} /> : <p>Loading the page…</p>}
            <div ref={overlay} className="ed-overlay" style={{ width: size.w, height: size.h }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { setGesture(null); setLive(null) }}>
              {placements.map((p, i) => {
                if (p.page !== page) return null
                const r = live?.idx === i ? live.rect : rectOf(p)
                const on = i === sel
                return (
                  <div
                    key={i}
                    data-idx={i}
                    className={`ed-box ${on ? 'on' : ''} ${p.mark ?? ''}`}
                    style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }}
                  >
                    <span className="ed-tag">{describe(p)}</span>
                    {p.mark === 'x' ? '✕' : p.mark === 'dot' ? '●' : ''}
                    {on && HANDLES.map((h) => <span key={h} data-idx={i} data-handle={h} className={`ed-handle ${h}`} />)}
                  </div>
                )
              })}
              {gesture?.mode === 'new' && <div className="ed-box draft" style={{ left: Math.min(gesture.x0, gesture.x1), top: Math.min(gesture.y0, gesture.y1), width: Math.abs(gesture.x1 - gesture.x0), height: Math.abs(gesture.y1 - gesture.y0) }} />}
            </div>
          </div>
        </div>
        <aside className="ed-side">
          {cur && sel !== null ? (
            <>
              <h4>This box</h4>
              <Select
                label="What goes here"
                value={kindOf(cur)}
                onChange={(v) =>
                  edit(sel, v === 'x' ? { mark: 'x', source: { kind: 'text', text: '' } } : v === 'dot' ? { mark: 'dot', source: { kind: 'text', text: '' } } : v === 'signature' ? { mark: undefined, source: { kind: 'signature' } } : { mark: undefined, source: cur.source.kind === 'signature' || (cur.source.kind === 'text' && cur.mark) ? { kind: 'field', field: 'firstName' } : cur.source })
                }
                options={[
                  ['text', 'Text'],
                  ['x', 'X mark'],
                  ['dot', 'Filled dot'],
                  ['signature', 'Signature'],
                ]}
              />
              {kindOf(cur) === 'text' && (
                <>
                  <Select label="Text comes from" value={encodeSource(cur.source)} onChange={(v) => edit(sel, { source: decodeSource(v, cur.source) ?? cur.source })} options={sourceOptions(content, { signature: false })} />
                  {cur.source.kind === 'text' && <TextInput label="Fixed text" value={cur.source.text} onChange={(v) => edit(sel, { source: { kind: 'text', text: v } })} />}
                  <TextInput label="Text size (blank = automatic)" type="number" value={cur.size ? String(cur.size) : ''} onChange={(v) => edit(sel, { size: v ? Number(v) : undefined })} />
                </>
              )}
              {(kindOf(cur) === 'x' || kindOf(cur) === 'dot') && (
                <Field label="Show this mark only when…" hint="Leave on “always” for a mark that is always there.">
                  <Select
                    value={cur.when?.field ?? ''}
                    onChange={(v) => edit(sel, { when: v ? { field: v, equals: valueChoices(v)?.[0] ?? '' } : undefined })}
                    options={[['', 'Always'], ...sourceOptions(content).filter(([v]) => v.startsWith('field:')).map(([v, l]): [string, string] => [v.slice(6), l.replace('My info: ', '')])]}
                  />
                  {cur.when &&
                    (valueChoices(cur.when.field) ? (
                      <Select value={cur.when.equals} onChange={(v) => edit(sel, { when: { field: cur.when!.field, equals: v } })} options={valueChoices(cur.when.field)!.map((v): [string, string] => [v, v])} />
                    ) : (
                      <input value={cur.when.equals} onChange={(e) => edit(sel, { when: { field: cur.when!.field, equals: e.target.value } })} placeholder="equals…" />
                    ))}
                </Field>
              )}
              <details className="ed-fine">
                <summary>Exact position and size</summary>
                <div className="ed-grid four">
                  {(['x', 'y', 'w', 'h'] as const).map((k) => (
                    <TextInput key={k} label={k.toUpperCase()} type="number" value={String(cur[k])} onChange={(v) => edit(sel, { [k]: Number(v) || 0 })} />
                  ))}
                </div>
              </details>
              <Btn kind="danger" onClick={() => remove(sel)}>Delete this box</Btn>
            </>
          ) : (
            <p>Click a box to change what goes in it, or drag on the page to draw a new one.</p>
          )}
          <h4>All boxes ({placements.length})</h4>
          <ul className="ed-boxlist">
            {placements.map((p, i) => (
              <li key={i}>
                <button type="button" className={i === sel ? 'on' : ''} onClick={() => { setPage(p.page); setSel(i) }}>
                  p{p.page + 1}: {describe(p)}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

const rectOf = (p: Placement): Rect => ({ x: p.x, y: p.y, w: p.w, h: p.h })
