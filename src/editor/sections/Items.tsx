import { useRef, useState } from 'react'
import type { Requirement } from '../../types'
import { useEd } from '../context'
import { Btn, Check, Select, TextArea, TextInput } from '../ui'
import { moved, readFile, uniqueId } from '../util'

export function ItemsSection() {
  const { content, update, attach } = useEd()
  const [sel, setSel] = useState(0)
  const pick = useRef<HTMLInputElement>(null)
  const items = content.items
  const i = Math.min(sel, items.length - 1)
  const it = items[i]
  const edit = (patch: Partial<Requirement>) => update((d) => Object.assign(d.items[i], patch))

  const add = () => {
    update((d) => {
      d.items.push({
        id: uniqueId('new-item', d.items.map((x) => x.id)),
        number: Math.max(0, ...d.items.map((x) => x.number), ...d.forms.map((f) => f.number ?? 0)) + 1,
        group: d.groups.find((g) => g.id !== 'sign')?.id ?? d.groups[0].id,
        title: 'New item',
        summary: '',
        handIn: 'What to hand in for this item',
        links: [],
        steps: [''],
      })
    })
    setSel(items.length)
  }

  return (
    <section className="ed-panel">
      <h2>Checklist items</h2>
      <p>The background checks, trainings and other steps volunteers work through. The signed forms are under Forms.</p>
      <div className="ed-split">
        <ul className="ed-list" aria-label="Checklist items">
          {items.map((x, j) => (
            <li key={x.id}>
              <button type="button" className={j === i ? 'on' : ''} onClick={() => setSel(j)}>
                <small>#{x.number}</small> {x.title}
              </button>
            </li>
          ))}
          <li>
            <Btn kind="primary" onClick={add}>Add an item</Btn>
          </li>
        </ul>
        {it && (
          <div className="ed-card wide">
            <TextInput label="Title" value={it.title} onChange={(v) => edit({ title: v })} />
            <TextArea label="Short description" rows={2} value={it.summary} onChange={(v) => edit({ summary: v })} />
            <div className="ed-grid">
              <Select label="Section" value={it.group} onChange={(v) => edit({ group: v })} options={content.groups.filter((g) => g.id !== 'sign').map((g) => [g.id, g.title])} />
              <TextInput label="Number on the diocese’s checklist" type="number" value={String(it.number)} onChange={(v) => edit({ number: Number(v) || 0 })} />
              <TextInput label="How long it takes (optional)" value={it.time ?? ''} onChange={(v) => edit({ time: v || undefined })} />
              <TextInput label="Valid for (years, blank if one time)" type="number" value={it.validYears ? String(it.validYears) : ''} onChange={(v) => edit({ validYears: v ? Number(v) : undefined })} />
            </div>
            <TextArea label="Important note (optional)" rows={2} value={it.note ?? ''} onChange={(v) => edit({ note: v || undefined })} hint="Shown in a highlighted box on the item." />
            <Check label="Optional: some volunteers can mark it “doesn’t apply”" checked={Boolean(it.optional)} onChange={(v) => edit({ optional: v || undefined })} />
            <Select
              label="Form that goes with this item (optional)"
              value={it.form ?? ''}
              onChange={(v) => edit({ form: v || undefined })}
              options={[['', 'None'], ...content.forms.map((f): [string, string] => [f.id, f.label])]}
            />

            <h3>Steps</h3>
            {it.steps.map((s, k) => (
              <div className="ed-step" key={k}>
                <textarea rows={2} value={s} onChange={(e) => update((d) => (d.items[i].steps[k] = e.target.value))} aria-label={`Step ${k + 1}`} />
                <div className="ed-col">
                  <Btn kind="ghost" onClick={() => update((d) => (d.items[i].steps = moved(d.items[i].steps, k, -1)))}>↑</Btn>
                  <Btn kind="ghost" onClick={() => update((d) => (d.items[i].steps = moved(d.items[i].steps, k, 1)))}>↓</Btn>
                  <Btn kind="danger" onClick={() => update((d) => (d.items[i].steps = d.items[i].steps.filter((_, j) => j !== k)))}>Remove</Btn>
                </div>
              </div>
            ))}
            <Btn onClick={() => update((d) => d.items[i].steps.push(''))}>Add a step</Btn>
            <p className="ed-hint">Steps accept <code>**bold**</code>, <code>[text](https://link)</code> and <code>{'{lsec}'}</code> for the coordinator’s name.</p>

            <h3>Links</h3>
            {it.links.map((l, k) => (
              <div className="ed-grid link" key={k}>
                <TextInput label="Link text" value={l.label} onChange={(v) => update((d) => (d.items[i].links[k].label = v))} />
                <TextInput label="Web address" value={l.href} onChange={(v) => update((d) => (d.items[i].links[k].href = v))} placeholder="https://" />
                <Btn kind="danger" onClick={() => update((d) => (d.items[i].links = d.items[i].links.filter((_, j) => j !== k)))}>Remove</Btn>
              </div>
            ))}
            <Btn onClick={() => update((d) => d.items[i].links.push({ label: '', href: '' }))}>Add a link</Btn>

            <h3>Instruction sheets (PDF)</h3>
            {(it.references ?? []).map((r, k) => (
              <div className="ed-grid link" key={k}>
                <TextInput label="Name" value={r.label} onChange={(v) => update((d) => (d.items[i].references![k].label = v))} />
                <div className="ed-field"><span>File</span><code>{r.file}</code></div>
                <Btn kind="danger" onClick={() => update((d) => (d.items[i].references = d.items[i].references!.filter((_, j) => j !== k)))}>Remove</Btn>
              </div>
            ))}
            <input ref={pick} type="file" accept="application/pdf" hidden onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const path = attach(f.name, await readFile(f))
              update((d) => (d.items[i].references = [...(d.items[i].references ?? []), { label: f.name.replace(/\.pdf$/i, ''), file: path }]))
            }} />
            <Btn onClick={() => pick.current?.click()}>Attach an instruction sheet</Btn>

            <h3>On the “what to hand in” list</h3>
            <TextInput label="Item" value={it.handIn} onChange={(v) => edit({ handIn: v })} />
            <TextInput label="Extra line (optional)" value={it.handInDetail ?? ''} onChange={(v) => edit({ handInDetail: v || undefined })} />

            <div className="ed-row">
              <Btn kind="ghost" onClick={() => { update((d) => (d.items = moved(d.items, i, -1))); setSel(Math.max(0, i - 1)) }}>Move up</Btn>
              <Btn kind="ghost" onClick={() => { update((d) => (d.items = moved(d.items, i, 1))); setSel(Math.min(items.length - 1, i + 1)) }}>Move down</Btn>
              <Btn kind="danger" onClick={() => { if (confirm(`Remove “${it.title}”?`)) { update((d) => (d.items = d.items.filter((_, j) => j !== i))); setSel(0) } }}>Remove this item</Btn>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
