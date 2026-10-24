import { useRef } from 'react'
import type { CustomField, FieldType } from '../../content/schema'
import { useEd } from '../context'
import { Btn, Check, Field, Select, TextArea, TextInput } from '../ui'
import { moved, readFile, uniqueId } from '../util'

export function SchoolSection() {
  const { content, update } = useEd()
  return (
    <section className="ed-panel">
      <h2>School and contacts</h2>
      <p>These appear across the site and in the instructions wherever you see the coordinator’s name.</p>
      <TextInput label="School name" value={content.school.name} onChange={(v) => update((d) => (d.school.name = v))} />
      <h3>Local Safe Environment Coordinator (LSEC)</h3>
      <div className="ed-grid">
        <TextInput label="Name" value={content.lsec.name} onChange={(v) => update((d) => (d.lsec.name = v))} />
        <TextInput label="Email" type="email" value={content.lsec.email} onChange={(v) => update((d) => (d.lsec.email = v))} />
      </div>
      <h3>Diocese contact for questions the coordinator can’t answer</h3>
      <div className="ed-grid">
        <TextInput label="Name" value={content.diocese.name} onChange={(v) => update((d) => (d.diocese.name = v))} />
        <TextInput label="Title" value={content.diocese.title} onChange={(v) => update((d) => (d.diocese.title = v))} />
        <TextInput label="Address" value={content.diocese.address} onChange={(v) => update((d) => (d.diocese.address = v))} />
        <TextInput label="Phone" value={content.diocese.phone} onChange={(v) => update((d) => (d.diocese.phone = v))} />
        <TextInput label="Email" type="email" value={content.diocese.email} onChange={(v) => update((d) => (d.diocese.email = v))} />
      </div>
    </section>
  )
}

export function ChecklistSection() {
  const { content, update, attach, files } = useEd()
  const pick = useRef<HTMLInputElement>(null)
  const c = content.checklist
  const set = (k: keyof typeof c, v: string) => update((d) => ((d.checklist[k] as string) = v))
  return (
    <section className="ed-panel">
      <h2>The diocese’s checklist</h2>
      <p>The site follows this document and shows its name and date on the Help page and in the footer of every page.</p>
      <div className="ed-grid">
        <TextInput label="Checklist name" value={c.name} onChange={(v) => set('name', v)} />
        <TextInput label="Revised on" value={c.revised} onChange={(v) => set('revised', v)} hint="As written on the document, for example 7/31/2025" />
      </div>
      <Field label="Checklist PDF on this site" hint={files.has(c.file) ? 'New file attached. It’s saved with your settings.' : 'To use a newer copy, download it from the diocese’s page and attach it here.'}>
        <div className="ed-row">
          <code>{c.file}</code>
          <input ref={pick} type="file" accept="application/pdf" hidden onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) set('file', attach(f.name, await readFile(f)))
            e.target.value = ''
          }} />
          <Btn onClick={() => pick.current?.click()}>Attach a newer PDF</Btn>
        </div>
      </Field>
      <h3>Where the diocese publishes it</h3>
      <TextInput label="Safe Environment Requirements page" value={c.requirementsUrl} onChange={(v) => set('requirementsUrl', v)} />
      <TextInput label="Limited Volunteer checklist (PDF)" value={c.limitedUrl} onChange={(v) => set('limitedUrl', v)} />
      <TextInput label="Safe Environment Policies page" value={c.policiesUrl} onChange={(v) => set('policiesUrl', v)} />
      <TextInput label="Last compared with the diocese’s pages" type="date" value={c.checkedOn} onChange={(v) => set('checkedOn', v)} hint="Shown in the footer. Update it each time you check the diocese’s pages." />
    </section>
  )
}

const TYPES: [FieldType, string][] = [
  ['text', 'Short text'],
  ['date', 'Date'],
  ['choice', 'Pick from a list'],
  ['yesno', 'Yes or no'],
]

export function FieldsSection() {
  const { content, update } = useEd()
  const add = () =>
    update((d) => {
      d.fields.push({ id: uniqueId('detail', d.fields.map((f) => f.id)), label: 'New detail', type: 'text' })
    })
  const edit = (i: number, patch: Partial<CustomField>) => update((d) => Object.assign(d.fields[i], patch))
  return (
    <section className="ed-panel">
      <h2>More “My info” details</h2>
      <p>
        The site already asks for name, address, birth date and so on. If one of your forms needs something else, add it here. It then appears on the My info page and
        you can pick it when you set up a form.
      </p>
      {content.fields.length === 0 && <p className="ed-empty">No extra details yet.</p>}
      {content.fields.map((f, i) => (
        <div className="ed-card" key={f.id}>
          <div className="ed-grid">
            <TextInput label="Label" value={f.label} onChange={(v) => edit(i, { label: v })} />
            <Select label="Kind of answer" value={f.type} onChange={(v) => edit(i, { type: v as FieldType, options: v === 'choice' ? f.options ?? ['Option 1'] : undefined })} options={TYPES} />
          </div>
          {f.type === 'choice' && <TextArea label="Choices" rows={3} value={(f.options ?? []).join('\n')} onChange={(v) => edit(i, { options: v.split('\n').map((s) => s.trim()).filter(Boolean) })} hint="One per line" />}
          <TextInput label="Help text (optional)" value={f.help ?? ''} onChange={(v) => edit(i, { help: v || undefined })} />
          <Check label="Ask for this only when making the files, and never save it" checked={Boolean(f.sensitive)} onChange={(v) => edit(i, { sensitive: v || undefined })} hint="Use for anything private, like an ID number. The site treats it the way it treats a Social Security Number." />
          <div className="ed-row">
            <Btn kind="ghost" onClick={() => update((d) => (d.fields = moved(d.fields, i, -1)))}>Move up</Btn>
            <Btn kind="ghost" onClick={() => update((d) => (d.fields = moved(d.fields, i, 1)))}>Move down</Btn>
            <Btn kind="danger" onClick={() => confirm(`Remove “${f.label}”? Forms that use it will leave that spot blank.`) && update((d) => (d.fields = d.fields.filter((_, j) => j !== i)))}>Remove</Btn>
          </div>
        </div>
      ))}
      <Btn kind="primary" onClick={add}>Add a detail</Btn>
    </section>
  )
}

export function FaqSection() {
  const { content, update } = useEd()
  return (
    <section className="ed-panel">
      <h2>Questions and answers (Help page)</h2>
      <p>
        Write answers as plain text. Leave a blank line between paragraphs. Use <code>**words**</code> for bold and <code>[link text](https://address)</code> for a link. You can
        also type <code>{'{lsec}'}</code>, <code>{'{lsecEmail}'}</code> or <code>{'{school}'}</code> and the site fills in the current names.
      </p>
      {content.faq.map((f, i) => (
        <div className="ed-card" key={i}>
          <TextInput label="Question" value={f.q} onChange={(v) => update((d) => (d.faq[i].q = v))} />
          <TextArea label="Answer" rows={6} value={f.a} onChange={(v) => update((d) => (d.faq[i].a = v))} />
          <div className="ed-row">
            <Btn kind="ghost" onClick={() => update((d) => (d.faq = moved(d.faq, i, -1)))}>Move up</Btn>
            <Btn kind="ghost" onClick={() => update((d) => (d.faq = moved(d.faq, i, 1)))}>Move down</Btn>
            <Btn kind="danger" onClick={() => confirm('Remove this question?') && update((d) => (d.faq = d.faq.filter((_, j) => j !== i)))}>Remove</Btn>
          </div>
        </div>
      ))}
      <Btn kind="primary" onClick={() => update((d) => d.faq.push({ q: 'New question', a: 'Answer' }))}>Add a question</Btn>
    </section>
  )
}
