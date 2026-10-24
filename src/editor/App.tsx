import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyContent, defaultContent } from '../content/apply'
import { validateContent, type Content } from '../content/schema'
import { EdContext, type Ed } from './context'
import { countChanges, describeChanges, type ChangeGroup } from './diff'
import { ChecklistSection, FaqSection, FieldsSection, SchoolSection } from './sections/Basics'
import { FormsSection } from './sections/Forms'
import { ItemsSection } from './sections/Items'
import { Btn, Field } from './ui'
import { normalizeSiteUrl, readFile } from './util'
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
const SITE_KEY = 'lsa-editor-site'

/** What's referenced from the content that lives in data/ (new PDFs the person attached). */
function referencedFiles(c: Content): string[] {
  return [...new Set([c.checklist.file, ...c.forms.flatMap((f) => (f.file ? [f.file] : [])), ...c.items.flatMap((i) => (i.references ?? []).map((r) => r.file))])].filter((p) => p.startsWith('data/'))
}

function download(name: string, bytes: Uint8Array | string, type: string) {
  const blob = new Blob([bytes as BlobPart], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

function remembered(): string {
  try {
    return localStorage.getItem(SITE_KEY) ?? ''
  } catch {
    return ''
  }
}

const looksLikePhone = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 900

function ChangeList({ groups }: { groups: ChangeGroup[] }) {
  if (groups.length === 0) return <p>Nothing has changed yet.</p>
  return (
    <div className="ed-changes">
      {groups.map((g) => (
        <details key={g.title} className="ed-group">
          <summary>
            {g.title} <span className="ed-count">{g.entries.length}</span>
          </summary>
          {g.entries.map((e, i) => (
            <details key={i} className="ed-entry">
              <summary>{e.title}</summary>
              <ul>{e.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
            </details>
          ))}
        </details>
      ))}
    </div>
  )
}

type Loaded = { label: string; how: 'site' | 'file' | 'builtin' }

export default function EditorApp() {
  const [original, setOriginal] = useState<Content>(() => clone(defaultContent))
  const [content, setContent] = useState<Content>(() => clone(defaultContent))
  const [files, setFiles] = useState<Map<string, Uint8Array>>(new Map())
  const [tab, setTab] = useState<Tab>('school')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [showLoad, setShowLoad] = useState(true)
  const [siteInput, setSiteInput] = useState(remembered)
  const [siteUrl, setSiteUrl] = useState('')
  const [loadMsg, setLoadMsg] = useState<{ ok: boolean; text: string; list?: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [phoneWarn, setPhoneWarn] = useState(looksLikePhone)
  const pick = useRef<HTMLInputElement>(null)
  const remote = useRef(new Map<string, Promise<Uint8Array | undefined>>())

  const groups = useMemo(() => describeChanges(original, content), [original, content])
  const changed = countChanges(groups)
  const validation = useMemo(() => validateContent(content), [content])
  const unattached = useMemo(() => (siteUrl ? [] : referencedFiles(content).filter((p) => !files.has(p))), [content, files, siteUrl])

  useEffect(() => {
    // The editor shares the site's settings code, so keep those in step for the previews.
    applyContent(content)
  }, [content])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (changed && !saved) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changed, saved])

  const fetchRemote = useCallback(
    (path: string): Promise<Uint8Array | undefined> => {
      if (!siteUrl || !/^(forms|data)\//.test(path) || path.includes('..')) return Promise.resolve(undefined)
      const key = siteUrl + path
      let p = remote.current.get(key)
      if (!p) {
        p = fetch(`${siteUrl}${path}?t=${Date.now()}`, { cache: 'no-store' })
          .then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined))
          .catch(() => undefined)
        remote.current.set(key, p)
      }
      return p
    },
    [siteUrl],
  )

  const ed: Ed = {
    content,
    files,
    siteUrl,
    fetchRemote,
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

  const adopt = (c: Content, how: Loaded, site: string) => {
    setOriginal(clone(c))
    setContent(clone(c))
    setFiles(new Map())
    remote.current = new Map()
    setSiteUrl(site)
    setLoaded(how)
    setShowLoad(false)
    setSaved(false)
  }

  const loadFromSite = async () => {
    const base = normalizeSiteUrl(siteInput)
    if (!base) return setLoadMsg({ ok: false, text: 'Type your website’s address, for example https://clearances.yourschool.org/' })
    setBusy(true)
    setLoadMsg(null)
    try {
      const res = await fetch(`${base}data/content.json?t=${Date.now()}`, { cache: 'no-store' })
      const isJson = (res.headers.get('content-type') ?? '').includes('json')
      if (res.ok && isJson) {
        const r = validateContent(await res.json())
        if (!r.ok) return setLoadMsg({ ok: false, text: 'The site has a settings file, but it has problems, so it wasn’t loaded:', list: r.errors.slice(0, 8) })
        try {
          localStorage.setItem(SITE_KEY, base)
        } catch {
          // fine: it just won't be remembered
        }
        adopt(r.content, { how: 'site', label: `Loaded from ${base}` }, base)
      } else {
        // No settings file yet: the site is running on the built-in settings, which is what the editor starts from.
        try {
          localStorage.setItem(SITE_KEY, base)
        } catch {
          // fine
        }
        adopt(clone(defaultContent), { how: 'site', label: `${base} has no custom settings yet, so this starts from the built-in settings` }, base)
      }
    } catch {
      setLoadMsg({
        ok: false,
        text: 'This page couldn’t read settings from that address. Check the address, or your web host may not allow it. You can open the settings file instead (the content.json from your site’s data folder).',
      })
    } finally {
      setBusy(false)
    }
  }

  const openFile = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(new TextDecoder().decode(await readFile(file)))
      const r = validateContent(raw)
      if (!r.ok) return setLoadMsg({ ok: false, text: 'That settings file has problems, so it wasn’t opened:', list: r.errors.slice(0, 8) })
      adopt(r.content, { how: 'file', label: `Opened ${file.name}` }, '')
    } catch {
      setLoadMsg({ ok: false, text: 'That file couldn’t be read. Choose the content.json from your site’s data folder.' })
    }
  }

  const startBuiltIn = () => adopt(clone(defaultContent), { how: 'builtin', label: 'Started from the built-in settings' }, '')

  const save = () => {
    if (!validation.ok) return
    const json = JSON.stringify(validation.content, null, 2) + '\n'
    const enc = new TextEncoder()
    const entries = [{ path: 'data/content.json', bytes: enc.encode(json) }, ...referencedFiles(content).flatMap((p) => (files.has(p) ? [{ path: p, bytes: files.get(p)! }] : []))]
    download('site-data.zip', makeZip(entries), 'application/zip')
    setSaved(true)
  }

  const loadPanel = (
    <section className="ed-panel ed-load">
      <h2>{loaded ? 'Load different settings' : 'First, load your site’s current settings'}</h2>
      <p>Your changes are made on top of what your website already shows, so you don’t start from scratch.</p>
      <Field label="Your website’s address" hint="The page volunteers use, for example https://clearances.yourschool.org/. The editor reads its settings and forms from there; it never changes the site.">
        <div className="ed-row tight">
          <input
            type="text"
            value={siteInput}
            placeholder="https://"
            onChange={(e) => setSiteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void loadFromSite()}
          />
          <Btn kind="primary" onClick={() => void loadFromSite()} disabled={busy}>{busy ? 'Loading…' : 'Load from my website'}</Btn>
        </div>
      </Field>
      <div className="ed-row">
        <input ref={pick} type="file" accept=".json,application/json" hidden onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void openFile(f)
        }} />
        <Btn onClick={() => pick.current?.click()}>Open a settings file instead (content.json)</Btn>
        <Btn kind="ghost" onClick={() => { if (!changed || confirm('Start over from the built-in settings? Your changes here will be lost.')) startBuiltIn() }}>Start from the built-in settings</Btn>
        {loaded && <Btn kind="ghost" onClick={() => setShowLoad(false)}>Cancel</Btn>}
      </div>
      {loadMsg && (
        <div className={loadMsg.ok ? 'ed-ok' : 'ed-error'} role="alert">
          <p>{loadMsg.text}</p>
          {loadMsg.list && <ul>{loadMsg.list.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      )}
    </section>
  )

  return (
    <EdContext.Provider value={ed}>
      {phoneWarn && (
        <div className="ed-phone" role="alert">
          <span>This editor is made for a computer with a mouse and a large screen. It may not work well on a phone or tablet.</span>
          <Btn kind="ghost" onClick={() => setPhoneWarn(false)}>Dismiss</Btn>
        </div>
      )}
      <header className="ed-top">
        <div className="ed-row between">
          <div>
            <h1>Volunteer Clearances: site editor</h1>
            <p>Change the wording, contacts and forms. Nothing is published until you save and upload the file it makes.</p>
          </div>
          {loaded && !showLoad && (
            <div className="ed-loaded">
              <span>{loaded.label}</span>
              <Btn kind="ghost" onClick={() => setShowLoad(true)}>Load different settings</Btn>
            </div>
          )}
        </div>
        {loaded && !showLoad && (
          <nav className="ed-tabs" aria-label="Sections">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                {label}
                {id === 'save' && changed > 0 && <span className="ed-count">{changed}</span>}
              </button>
            ))}
          </nav>
        )}
      </header>
      <main className="ed-main">
        {(!loaded || showLoad) && loadPanel}
        {loaded && !showLoad && (
          <>
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
                    <h3>What changed ({changed})</h3>
                    <ChangeList groups={groups} />
                    {unattached.length > 0 && <ul className="ed-hint">{unattached.map((m) => <li key={m}>{m} is used but isn’t attached in this session; it must already be in your data folder.</li>)}</ul>}
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
          </>
        )}
      </main>
    </EdContext.Provider>
  )
}
