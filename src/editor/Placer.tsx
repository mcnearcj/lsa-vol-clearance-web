import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormInfo } from '../data/forms'
import type { Placement } from '../content/schema'
import { useEd } from './context'
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

type Drag = { x0: number; y0: number; x1: number; y1: number }

/** Shows a PDF page and lets the person draw a box where an answer belongs, then say what goes in it. */
export function Placer({ form, bytes }: { form: FormInfo; bytes: Uint8Array }) {
  const { content, update, files } = useEd()
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // Pixels per PDF point, chosen so the page fits the space available.
  const [scale, setScale] = useState(1.2)
  const holder = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<Uint8Array | null>(null)
  const [signed, setSigned] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const overlay = useRef<HTMLDivElement>(null)
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
    let live = true
    const fit = async () => {
      const pt = (await doc.getPage(page + 1)).getViewport({ scale: 1 }).width
      if (live && el.clientWidth > 0) setScale(Math.max(0.7, Math.min(1.5, (el.clientWidth - 4) / pt)))
    }
    void fit()
    const ro = new ResizeObserver(() => void fit())
    ro.observe(el)
    return () => {
      live = false
      ro.disconnect()
    }
  }, [doc, page])
  const onSize = useCallback((w: number, h: number) => setSize({ w, h }), [])

  const edit = (i: number, patch: Partial<Placement>) =>
    update((d) => {
      const f = d.forms.find((x) => x.id === form.id)!
      Object.assign(f.placements![i], patch)
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
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.idx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = local(e)
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
    setSel(null)
  }
  const move = (e: React.PointerEvent) => {
    if (!drag) return
    const p = local(e)
    setDrag({ ...drag, x1: p.x, y1: p.y })
  }
  const up = (e: React.PointerEvent) => {
    if (!drag) return
    // Take the end point from the release itself, so a quick drag with few move events still counts.
    const end = local(e)
    const x = Math.min(drag.x0, end.x)
    const y = Math.min(drag.y0, end.y)
    const w = Math.abs(end.x - drag.x0)
    const h = Math.abs(end.y - drag.y0)
    setDrag(null)
    if (w < 8 || h < 5) return
    const added: Placement = { page, x: round(x / scale), y: round(y / scale), w: round(w / scale), h: round(h / scale), source: { kind: 'field', field: 'firstName' } }
    update((d) => {
      const f = d.forms.find((v) => v.id === form.id)!
      f.placements = [...(f.placements ?? []), added]
    })
    setSel(placements.length)
  }

  const runPreview = async () => {
    setBusy(true)
    setError('')
    try {
      setPreview(await previewForm(content, form.id, files, signed))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The preview could not be made.')
    } finally {
      setBusy(false)
    }
  }

  const cur = sel !== null ? placements[sel] : undefined
  const valueChoices = (field: string): string[] | null => KNOWN_VALUES[field] ?? content.fields.find((f) => f.id === field && (f.type === 'choice' || f.type === 'yesno'))?.options ?? (content.fields.find((f) => f.id === field)?.type === 'yesno' ? ['Yes', 'No'] : null)
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
        <strong>Draw a box</strong> over each line or spot where something should go (click and drag on the page). Then choose what goes in it. For a check box or a circle to
        fill in, draw a small box over it and pick “X mark” or “Filled dot”.
      </p>
      <div className="ed-row">
        {doc && doc.numPages > 1 && (
          <Select value={String(page)} onChange={(v) => { setPage(Number(v)); setSel(null) }} options={Array.from({ length: doc.numPages }, (_, i) => [String(i), `Page ${i + 1}`])} />
        )}
        <Check label="Preview as if signed on screen" checked={signed} onChange={setSigned} />
        <Btn kind="primary" onClick={() => void runPreview()} disabled={busy || placements.length === 0}>{busy ? 'Making preview…' : 'Preview with sample information'}</Btn>
      </div>
      {error && <p className="ed-error" role="alert">{error}</p>}
      <div className="ed-placer-body">
        <div className="ed-canvas-col" ref={holder}>
         <div className="ed-canvas-wrap" style={{ width: size.w || undefined }}>
          {doc ? <PageCanvas doc={doc} page={page} scale={scale} onSize={onSize} /> : <p>Loading the page…</p>}
          <div ref={overlay} className="ed-overlay" style={{ width: size.w, height: size.h }} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
            {placements.map((p, i) =>
              p.page === page ? (
                <div
                  key={i}
                  data-idx={i}
                  className={`ed-box ${i === sel ? 'on' : ''} ${p.mark ?? ''}`}
                  style={{ left: p.x * scale, top: p.y * scale, width: p.w * scale, height: p.h * scale }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setSel(i)
                  }}
                  title={describe(p, content.fields)}
                >
                  {p.mark === 'x' ? '✕' : p.mark === 'dot' ? '●' : ''}
                </div>
              ) : null,
            )}
            {drag && <div className="ed-box draft" style={{ left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1), width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) }} />}
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
                  edit(sel, v === 'x' ? { mark: 'x', source: { kind: 'text', text: '' } } : v === 'dot' ? { mark: 'dot', source: { kind: 'text', text: '' } } : v === 'signature' ? { mark: undefined, source: { kind: 'signature' } } : { mark: undefined, source: cur.source.kind === 'signature' || cur.source.kind === 'text' && cur.mark ? { kind: 'field', field: 'firstName' } : cur.source })
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
              <div className="ed-grid four">
                {(['x', 'y', 'w', 'h'] as const).map((k) => (
                  <TextInput key={k} label={k.toUpperCase()} type="number" value={String(cur[k])} onChange={(v) => edit(sel, { [k]: Number(v) || 0 })} />
                ))}
              </div>
              <Btn kind="danger" onClick={() => remove(sel)}>Delete this box</Btn>
            </>
          ) : (
            <p>Click a box to change it, or draw a new one.</p>
          )}
          <h4>All boxes ({placements.length})</h4>
          <ul className="ed-boxlist">
            {placements.map((p, i) => (
              <li key={i}>
                <button type="button" className={i === sel ? 'on' : ''} onClick={() => { setPage(p.page); setSel(i) }}>
                  p{p.page + 1}: {describe(p, content.fields)}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}

const round = (n: number) => Math.round(n * 10) / 10

function describe(p: Placement, fields: { id: string; label: string }[]): string {
  const src = p.source
  const what =
    p.mark === 'x' ? 'X mark' : p.mark === 'dot' ? 'Filled dot' : src.kind === 'field' ? (fields.find((f) => f.id === src.field)?.label ?? src.field) : src.kind === 'text' ? `“${src.text}”` : src.kind
  return p.when ? `${what} if ${fields.find((f) => f.id === p.when!.field)?.label ?? p.when.field} = ${p.when.equals}` : what
}
