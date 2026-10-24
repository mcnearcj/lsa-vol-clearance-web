import { useEffect, useRef, useState } from 'react'
import type { FormInfo, FormKind } from '../../data/forms'
import { useEd } from '../context'
import { Placer } from '../Placer'
import { PdfPages } from '../PdfPreview'
import { listPdfFields, type PdfFieldInfo } from '../pdfInfo'
import { previewForm } from '../sample'
import { decodeSource, encodeSource, sourceOptions } from '../sources'
import { Btn, Check, Select, TextArea, TextInput } from '../ui'
import { readFile, uniqueId } from '../util'

const KIND_TEXT: Record<FormKind, string> = {
  'built-in': 'Built-in layout',
  download: 'Print only',
  fillable: 'PDF with fields',
  placed: 'PDF with boxes you place',
}

const today = () => new Date().toISOString().slice(0, 10)

export function FormsSection() {
  const { content, update } = useEd()
  const [sel, setSel] = useState(0)
  const forms = content.forms
  const i = Math.min(sel, forms.length - 1)
  const form = forms[i]

  const add = (kind: Exclude<FormKind, 'built-in'>) => {
    update((d) => {
      const id = uniqueId('new-form', d.forms.map((f) => f.id))
      d.forms.push({
        id,
        kind,
        label: 'New form',
        handIn: 'Signed new form',
        handTo: 'lsec',
        ...(kind === 'fillable' ? { mapping: {} } : {}),
        ...(kind === 'placed' ? { placements: [] } : {}),
      })
    })
    setSel(forms.length)
  }

  return (
    <section className="ed-panel">
      <h2>Forms</h2>
      <p>The documents volunteers sign or print. Pick one to change its wording or links, or add a new form.</p>
      <div className="ed-split">
        <ul className="ed-list" aria-label="Forms">
          {forms.map((f, j) => (
            <li key={f.id}>
              <button type="button" className={j === i ? 'on' : ''} onClick={() => setSel(j)}>
                {f.label}
                <small>{KIND_TEXT[f.kind]}</small>
              </button>
            </li>
          ))}
          <li className="ed-add">
            <strong>Add a form</strong>
            <Btn onClick={() => add('download')}>A PDF to print and fill in by hand</Btn>
            <Btn onClick={() => add('fillable')}>A PDF that has fill-in fields</Btn>
            <Btn onClick={() => add('placed')}>A PDF without fields (I’ll place the boxes)</Btn>
            <small>Not sure? Open the PDF and click in it: if text boxes light up, it has fields.</small>
          </li>
        </ul>
        {form && <FormEditor key={form.id} form={form} index={i} onRemoved={() => setSel(0)} />}
      </div>
    </section>
  )
}

function FormEditor({ form, index, onRemoved }: { form: FormInfo; index: number; onRemoved: () => void }) {
  const { update, files, attach } = useEd()
  const pick = useRef<HTMLInputElement>(null)
  const bytes = form.file ? files.get(form.file) : undefined
  const edit = (patch: Partial<FormInfo>) => update((d) => Object.assign(d.forms[index], patch))

  const onPick = async (file: File) => {
    const data = await readFile(file)
    const path = attach(file.name, data)
    edit({ file: path, copiedOn: today() })
  }

  return (
    <div className="ed-card wide">
      <p className="ed-badge">{KIND_TEXT[form.kind]}</p>
      <TextInput label="Name of the form" value={form.label} onChange={(v) => edit({ label: v })} />
      <TextArea label="Note under the name (optional)" rows={2} value={form.note ?? ''} onChange={(v) => edit({ note: v || undefined })} />
      <div className="ed-grid">
        <Select label="Who gets the signed form" value={form.handTo} onChange={(v) => edit({ handTo: v as 'lsec' | 'state' })} options={[['lsec', 'The school’s coordinator'], ['state', 'The state (volunteer sends it)']]} />
        <TextInput label="Number on the diocese’s checklist (optional)" type="number" value={form.number ? String(form.number) : ''} onChange={(v) => edit({ number: v ? Number(v) : undefined })} />
      </div>
      <TextInput label="On the “what to hand in” list" value={form.handIn} onChange={(v) => edit({ handIn: v })} />
      <TextInput label="Extra line there (optional)" value={form.handInDetail ?? ''} onChange={(v) => edit({ handInDetail: v || undefined })} />

      <h3>Where it comes from</h3>
      <TextInput label="Official source (web address)" value={form.sourceUrl ?? ''} onChange={(v) => edit({ sourceUrl: v || undefined })} placeholder="https://" hint="Shown to volunteers as the official source. For a print-only form with no PDF attached, this is the address they open." />
      <TextInput label="Policy to read first (web address, optional)" value={form.policy ?? ''} onChange={(v) => edit({ policy: v || undefined })} placeholder="https://" />

      {(
        <>
          <h3>The PDF</h3>
          <div className="ed-row">
            <code>{form.file ?? (form.kind === 'download' ? 'none (volunteers open the source address)' : 'not attached yet')}</code>
            <input ref={pick} type="file" accept="application/pdf" hidden onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) await onPick(f)
            }} />
            <Btn onClick={() => pick.current?.click()}>{form.file ? 'Replace the PDF' : 'Attach the PDF'}</Btn>
            {form.file && form.kind === 'download' && <Btn kind="ghost" onClick={() => edit({ file: undefined })}>Don’t use a copy</Btn>}
          </div>
          {form.copiedOn && <p className="ed-hint">Copy attached on {form.copiedOn}. Download the PDF from the official source first, then attach it.</p>}
        </>
      )}

      {form.kind === 'built-in' && (
        <p className="ed-hint">
          This form’s layout is built into the site. You can change its wording and links, and swap in a revised PDF <em>only if its layout is the same</em>. If the diocese
          changes the layout, the filled-in text can land in the wrong place: check a preview and ask a technical person if it does.
        </p>
      )}

      {form.kind === 'fillable' && <FillableMapping form={form} index={index} bytes={bytes} />}
      {form.kind === 'placed' && (bytes ? <Placer form={form} bytes={bytes} /> : form.file ? <p className="ed-hint">Attach the PDF again to change where its boxes go. The boxes you placed are kept.</p> : null)}
      {form.kind === 'built-in' && bytes && <PreviewButton formId={form.id} />}

      <div className="ed-row">
        <Btn kind="ghost" onClick={() => update((d) => { const a = d.forms; if (index > 0) [a[index - 1], a[index]] = [a[index], a[index - 1]] })}>Move up</Btn>
        <Btn kind="ghost" onClick={() => update((d) => { const a = d.forms; if (index < a.length - 1) [a[index + 1], a[index]] = [a[index], a[index + 1]] })}>Move down</Btn>
        <Btn
          kind="danger"
          onClick={() => {
            if (!confirm(`Remove “${form.label}”?`)) return
            update((d) => {
              d.forms = d.forms.filter((f) => f.id !== form.id)
              d.items.forEach((it) => it.form === form.id && delete it.form)
            })
            onRemoved()
          }}
        >
          Remove this form
        </Btn>
      </div>
    </div>
  )
}

function PreviewButton({ formId }: { formId: string }) {
  const { content, files } = useEd()
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [error, setError] = useState('')
  return (
    <div>
      <div className="ed-row">
        <Btn onClick={() => previewForm(content, formId, files, true).then(setBytes).catch((e: unknown) => setError(e instanceof Error ? e.message : 'The preview could not be made.'))}>Preview with sample information</Btn>
        {bytes && <Btn kind="ghost" onClick={() => setBytes(null)}>Hide preview</Btn>}
      </div>
      {error && <p className="ed-error" role="alert">{error}</p>}
      {bytes && <PdfPages bytes={bytes} />}
    </div>
  )
}

function FillableMapping({ form, index, bytes }: { form: FormInfo; index: number; bytes: Uint8Array | undefined }) {
  const { content, update } = useEd()
  const [fields, setFields] = useState<PdfFieldInfo[] | null>(null)
  const [error, setError] = useState('')
  const [signed, setSigned] = useState(true)
  const [preview, setPreview] = useState<Uint8Array | null>(null)
  const { files } = useEd()

  useEffect(() => {
    if (!bytes) return
    let live = true
    listPdfFields(bytes).then((r) => live && setFields(r.fields), (e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not read the PDF.'))
    return () => {
      live = false
    }
  }, [bytes])

  if (!bytes) return <p className="ed-hint">Attach the PDF to set up its fields.</p>
  if (error) return <p className="ed-error" role="alert">{error}</p>
  if (!fields) return <p>Reading the PDF…</p>
  if (fields.length === 0)
    return (
      <p className="ed-error" role="alert">
        This PDF has no fill-in fields. Remove this form and add it again as “A PDF without fields” to place the boxes yourself.
      </p>
    )

  const set = (name: string, v: string) =>
    update((d) => {
      const f = d.forms[index]
      const next = { ...(f.mapping ?? {}) }
      const src = decodeSource(v, next[name])
      if (src) next[name] = src
      else delete next[name]
      f.mapping = next
    })

  return (
    <div>
      <h3>What goes in each field</h3>
      <table className="ed-map">
        <thead>
          <tr>
            <th>Field in the PDF</th>
            <th>What goes in it</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => {
            const src = form.mapping?.[f.name]
            return (
              <tr key={f.name}>
                <td>
                  {f.name} <small>({f.kind === 'text' ? 'text box' : f.kind === 'checkbox' ? 'check box: checked when there is an answer' : f.kind === 'choice' ? 'list' : f.kind === 'signature' ? 'signature box' : 'other'})</small>
                </td>
                <td>
                  <Select value={encodeSource(src)} onChange={(v) => set(f.name, v)} options={[['', '(leave blank)'], ...sourceOptions(content)]} />
                  {src?.kind === 'text' && <input value={src.text} onChange={(e) => update((d) => (d.forms[index].mapping![f.name] = { kind: 'text', text: e.target.value }))} placeholder="Fixed text" />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="ed-row">
        <Check label="Preview as if signed on screen" checked={signed} onChange={setSigned} />
        <Btn kind="primary" onClick={() => previewForm(content, form.id, files, signed).then(setPreview).catch((e: unknown) => setError(e instanceof Error ? e.message : 'The preview could not be made.'))}>Preview with sample information</Btn>
        {preview && <Btn kind="ghost" onClick={() => setPreview(null)}>Hide preview</Btn>}
      </div>
      {preview && <PdfPages bytes={preview} />}
    </div>
  )
}
