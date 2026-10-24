import { useEffect, useMemo, useRef, useState } from 'react'
import { applyContent, defaultContent } from '../content/apply'
import { validateContent, type Content } from '../content/schema'
import { EdContext, type Ed } from './context'
import { ChecklistSection, FaqSection, FieldsSection, SchoolSection } from './sections/Basics'
import { FormsSection } from './sections/Forms'
import { ItemsSection } from './sections/Items'
import { Btn } from './ui'
import { readFile } from './util'
import { makeZip } from './zip'

const TABS = [
  ['school', 'School and contacts'],
  ['checklist', 'Diocese checklist'],
  ['items', 'Checklist items'],
  ['forms', 'Forms'],
  ['fields', 'My info details'],
  ['faq', 'Questions'],
  ['save', 'Save'],
] as const
type Tab = (typeof TABS)[number][0]

const clone = <T,>(v: T): T => structuredClone(v)

/** What's referenced from the content that lives in data/ (new PDFs the person attached). */
function referencedFiles(c: Content): string[] {
  return [...new Set([c.checklist.file, ...c.forms.flatMap((f) => (f.file ? [f.file] : [])), ...c.items.flatMap((i) => (i.references ?? []).map((r) => r.file))])].filter((p) => p.startsWith('data/'))
}

/** A short list of what changed since the settings were opened. */
function describeChanges(before: Content, after: Content): string[] {
  const out: string[] = []
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  if (!same(before.school, after.school)) out.push('School name changed')
  if (!same(before.lsec, after.lsec)) out.push('Coordinator changed')
  if (!same(before.diocese, after.diocese)) out.push('Diocese contact changed')
  if (!same(before.checklist, after.checklist)) out.push('Diocese checklist details changed')
  const listChanges = <T extends { id: string }>(label: string, a: T[], b: T[], name: (x: T) => string) => {
    for (const x of b) if (!a.some((y) => y.id === x.id)) out.push(`${label} added: ${name(x)}`)
    for (const x of a) if (!b.some((y) => y.id === x.id)) out.push(`${label} removed: ${name(x)}`)
    for (const x of b) {
      const old = a.find((y) => y.id === x.id)
      if (old && !same(old, x)) out.push(`${label} changed: ${name(x)}`)
    }
  }
  listChanges('Item', before.items, after.items, (x) => x.title)
  listChanges('Form', before.forms, after.forms, (x) => x.label)
  listChanges('Detail', before.fields, after.fields, (x) => x.label)
  if (!same(before.faq, after.faq)) out.push('Questions and answers changed')
  if (!same(before.groups, after.groups)) out.push('Sections changed')
  return out
}

function download(name: string, bytes: Uint8Array | string, type: string) {
  const blob = new Blob([bytes as BlobPart], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

export default function EditorApp() {
  const [original, setOriginal] = useState<Content>(() => clone(defaultContent))
  const [content, setContent] = useState<Content>(() => clone(defaultContent))
  const [files, setFiles] = useState<Map<string, Uint8Array>>(new Map())
  const [tab, setTab] = useState<Tab>('school')
  const [openErrors, setOpenErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const pick = useRef<HTMLInputElement>(null)

  const changes = useMemo(() => describeChanges(original, content), [original, content])
  const validation = useMemo(() => validateContent(content), [content])
  const missing = useMemo(() => {
    const problems: string[] = []
    for (const p of referencedFiles(content)) if (!files.has(p)) problems.push(`${p} was referenced but isn’t attached in this session; it must already be in your data folder.`)
    return problems
  }, [content, files])

  useEffect(() => {
    // The editor shares the site's settings code, so keep those in step for the previews.
    applyContent(content)
  }, [content])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (changes.length && !saved) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changes.length, saved])

  const ed: Ed = {
    content,
    files,
    update: (fn) => {
      setSaved(false)
      setContent((c) => {
        const next = clone(c)
        fn(next)
        return next
      })
    },
    attach: (name, bytes) => {
      const base = name.replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'form'
      let path = `data/forms/${base}.pdf`
      let n = 2
      while (files.has(path) && JSON.stringify([...files.get(path)!]) !== JSON.stringify([...bytes])) path = `data/forms/${base}-${n++}.pdf`
      setFiles((f) => new Map(f).set(path, bytes))
      setSaved(false)
      return path
    },
  }

  const open = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(new TextDecoder().decode(await readFile(file)))
      const r = validateContent(raw)
      if (!r.ok) return setOpenErrors(r.errors)
      setOpenErrors([])
      setOriginal(clone(r.content))
      setContent(clone(r.content))
      setFiles(new Map())
    } catch {
      setOpenErrors(['That file couldn’t be read. Choose the content.json from your data folder.'])
    }
  }

  const save = () => {
    if (!validation.ok) return
    const json = JSON.stringify(validation.content, null, 2) + '\n'
    const enc = new TextEncoder()
    const entries = [{ path: 'data/content.json', bytes: enc.encode(json) }, ...referencedFiles(content).flatMap((p) => (files.has(p) ? [{ path: p, bytes: files.get(p)! }] : []))]
    download('site-data.zip', makeZip(entries), 'application/zip')
    setSaved(true)
  }

  return (
    <EdContext.Provider value={ed}>
      <header className="ed-top">
        <div>
          <h1>Volunteer Clearances: site editor</h1>
          <p>Change the wording, contacts and forms. Nothing here is published until you save and upload the file it makes.</p>
        </div>
        <div className="ed-row">
          <input ref={pick} type="file" accept=".json,application/json" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void open(f)
          }} />
          <Btn onClick={() => pick.current?.click()}>Open my settings (content.json)</Btn>
          <Btn kind="ghost" onClick={() => { if (!changes.length || confirm('Start over from the built-in settings? Your changes here will be lost.')) { setOriginal(clone(defaultContent)); setContent(clone(defaultContent)); setFiles(new Map()) } }}>Start from the built-in settings</Btn>
        </div>
        {openErrors.length > 0 && (
          <div className="ed-error" role="alert">
            <p>That settings file has problems, so it wasn’t opened:</p>
            <ul>{openErrors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        <nav className="ed-tabs" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setOpenErrors([]) }}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="ed-main">
        {tab === 'school' && <SchoolSection />}
        {tab === 'checklist' && <ChecklistSection />}
        {tab === 'items' && <ItemsSection />}
        {tab === 'forms' && <FormsSection />}
        {tab === 'fields' && <FieldsSection />}
        {tab === 'faq' && <FaqSection />}
        {tab === 'save' && (
          <section className="ed-panel">
            <h2>Save</h2>
            {!validation.ok ? (
              <div className="ed-error" role="alert">
                <p>Fix these before saving:</p>
                <ul>{validation.errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            ) : (
              <>
                <h3>What changed</h3>
                {changes.length ? <ul>{changes.map((c) => <li key={c}>{c}</li>)}</ul> : <p>Nothing yet.</p>}
                {missing.length > 0 && <ul className="ed-hint">{missing.map((m) => <li key={m}>{m}</li>)}</ul>}
                <div className="ed-row">
                  <Btn kind="primary" onClick={save}>Download site-data.zip</Btn>
                  <Btn kind="ghost" onClick={() => download('content.json', JSON.stringify(validation.content, null, 2) + '\n', 'application/json')}>Download only content.json</Btn>
                </div>
                {saved && <p className="ed-ok">Saved. Follow the steps below to put it on the site.</p>}
                <h3>Then put it on the website</h3>
                <ol>
                  <li>Unzip <code>site-data.zip</code>. You’ll get a folder named <code>data</code>.</li>
                  <li>Copy that <code>data</code> folder into your site folder, next to <code>index.html</code>. Say yes if it asks to merge or replace.</li>
                  <li>Upload the whole site folder to your web host the same way you did the first time.</li>
                  <li>Open the website and check the Help page. Keep the zip and this editor file somewhere safe.</li>
                </ol>
              </>
            )}
          </section>
        )}
      </main>
    </EdContext.Provider>
  )
}
