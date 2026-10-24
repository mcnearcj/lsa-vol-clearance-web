import type { Content, Placement } from '../content/schema'
import type { FormInfo } from '../data/forms'
import type { Requirement } from '../types'
import { labelOfField } from '../data/formFields'

export interface ChangeEntry {
  /** One line, e.g. "Changed: PATCH check". */
  title: string
  /** The details behind it, one per line. */
  lines: string[]
}
export interface ChangeGroup {
  title: string
  entries: ChangeEntry[]
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** A short, readable form of a value for the change list. */
export function short(v: unknown): string {
  if (v === undefined || v === null || v === '') return '(blank)'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'number') return String(v)
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  const flat = s.replace(/\s+/g, ' ').trim()
  return `“${flat.length > 70 ? flat.slice(0, 67) + '…' : flat}”`
}

const change = (label: string, a: unknown, b: unknown) => `${label}: ${short(a)} → ${short(b)}`

/** Lines for every field of two plain objects that differ. */
function fieldLines(label: Record<string, string>, before: object, after: object): string[] {
  const a = before as Record<string, unknown>
  const b = after as Record<string, unknown>
  const out: string[] = []
  for (const [k, name] of Object.entries(label)) if (!same(a[k], b[k])) out.push(change(name, a[k], b[k]))
  return out
}

function listLines<T>(label: string, a: T[], b: T[], show: (x: T) => string): string[] {
  const out: string[] = []
  const key = (x: T) => JSON.stringify(x)
  const had = new Set(a.map(key))
  const has = new Set(b.map(key))
  for (const x of b) if (!had.has(key(x))) out.push(`${label} added: ${show(x)}`)
  for (const x of a) if (!has.has(key(x))) out.push(`${label} removed: ${show(x)}`)
  if (out.length === 0 && !same(a, b)) out.push(`${label} reordered`)
  return out
}

const ITEM_FIELDS = {
  title: 'Title',
  summary: 'Short description',
  group: 'Section',
  number: 'Checklist number',
  time: 'How long it takes',
  validYears: 'Valid for (years)',
  note: 'Important note',
  optional: 'Optional',
  form: 'Linked form',
  handIn: 'Hand-in line',
  handInDetail: 'Hand-in extra line',
}

const FORM_FIELDS = {
  label: 'Name',
  kind: 'Kind',
  note: 'Note',
  handTo: 'Who gets it',
  number: 'Checklist number',
  handIn: 'Hand-in line',
  handInDetail: 'Hand-in extra line',
  sourceUrl: 'Official source',
  policy: 'Policy address',
  file: 'PDF',
}

/** What a box does, without where it is, so a moved box can be matched with its old self. */
const placementWhat = (p: Placement, c: Content): string => {
  const src = p.source
  const label = { name: 'Full name', date: 'Today’s date', signature: 'Signature', ssn: 'Social Security Number' }
  const what =
    p.mark === 'x' ? 'X mark' : p.mark === 'dot' ? 'Filled dot' : src.kind === 'field' ? (c.fields.find((f) => f.id === src.field)?.label ?? labelOfField(src.field)) : src.kind === 'text' ? `“${src.text}”` : label[src.kind]
  return `${what}${p.when ? ` if ${labelOfField(p.when.field)} = ${p.when.equals}` : ''} (page ${p.page + 1})`
}
const placementWhere = (p: Placement) => `${Math.round(p.x)},${Math.round(p.y)}, ${Math.round(p.w)}×${Math.round(p.h)}`

/** Boxes added, removed, and moved or resized (a removed and an added box that do the same thing are one change). */
function boxLines(a: Placement[], b: Placement[], ca: Content, cb: Content): string[] {
  const key = (p: Placement) => JSON.stringify(p)
  const had = new Set(a.map(key))
  const has = new Set(b.map(key))
  const gone = a.filter((p) => !has.has(key(p)))
  const fresh = b.filter((p) => !had.has(key(p)))
  const out: string[] = []
  const used = new Set<Placement>()
  for (const g of gone) {
    const what = placementWhat(g, ca)
    const match = fresh.find((f) => !used.has(f) && placementWhat(f, cb) === what)
    if (match) {
      used.add(match)
      out.push(`Box changed: ${what}: ${placementWhere(g)} → ${placementWhere(match)}`)
    } else out.push(`Box removed: ${what} at ${placementWhere(g)}`)
  }
  for (const f of fresh) if (!used.has(f)) out.push(`Box added: ${placementWhat(f, cb)} at ${placementWhere(f)}`)
  if (!out.length && !same(a, b)) out.push('Boxes reordered')
  return out
}

function itemLines(a: Requirement, b: Requirement): string[] {
  const out = fieldLines(ITEM_FIELDS, a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>)
  const steps = Math.max(a.steps.length, b.steps.length)
  for (let i = 0; i < steps; i++) {
    if (a.steps[i] === undefined) out.push(`Step ${i + 1} added: ${short(b.steps[i])}`)
    else if (b.steps[i] === undefined) out.push(`Step ${i + 1} removed: ${short(a.steps[i])}`)
    else if (a.steps[i] !== b.steps[i]) out.push(change(`Step ${i + 1}`, a.steps[i], b.steps[i]))
  }
  out.push(...listLines('Link', a.links, b.links, (l) => `${short(l.label)} → ${l.href}`))
  out.push(...listLines('Instruction sheet', a.references ?? [], b.references ?? [], (r) => `${short(r.label)} (${r.file})`))
  return out
}

function formLines(a: FormInfo, b: FormInfo, ca: Content, cb: Content): string[] {
  const out = fieldLines(FORM_FIELDS, a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>)
  const ma = a.mapping ?? {}
  const mb = b.mapping ?? {}
  for (const k of new Set([...Object.keys(ma), ...Object.keys(mb)])) if (!same(ma[k], mb[k])) out.push(`PDF field “${k}”: ${short(ma[k] ? JSON.stringify(ma[k]) : undefined)} → ${short(mb[k] ? JSON.stringify(mb[k]) : undefined)}`)
  out.push(...boxLines(a.placements ?? [], b.placements ?? [], ca, cb))
  return out
}

/** What changed between the settings that were opened and the ones being edited, grouped and detailed. */
export function describeChanges(before: Content, after: Content): ChangeGroup[] {
  const groups: ChangeGroup[] = []
  const add = (title: string, entries: ChangeEntry[]) => entries.length && groups.push({ title, entries })

  const basics: ChangeEntry[] = []
  const push = (title: string, lines: string[]) => lines.length && basics.push({ title, lines })
  push('School', fieldLines({ name: 'School name', tagline: 'Tagline', footerNote: 'Footer note', homeUrl: 'School website', logoUrl: 'Logo address', address: 'Street address', phone: 'Phone' }, before.school, after.school))
  push('Coordinator', fieldLines({ name: 'Name', email: 'Email' }, before.lsec, after.lsec))
  push('Diocese contact', fieldLines({ name: 'Name', title: 'Title', address: 'Address', phone: 'Phone', email: 'Email' }, before.diocese, after.diocese))
  push(
    'Diocese checklist',
    fieldLines({ name: 'Name', revised: 'Revised on', file: 'PDF', requirementsUrl: 'Requirements page', limitedUrl: 'Limited checklist', policiesUrl: 'Policies page', checkedOn: 'Last compared' }, before.checklist, after.checklist),
  )
  add('School and checklist details', basics)

  const entries = <T extends { id: string }>(a: T[], b: T[], name: (x: T) => string, lines: (x: T, y: T) => string[], thing: string): ChangeEntry[] => {
    const out: ChangeEntry[] = []
    for (const y of b) {
      const x = a.find((o) => o.id === y.id)
      if (!x) out.push({ title: `Added: ${name(y)}`, lines: [`New ${thing}`] })
      else if (!same(x, y)) {
        const l = lines(x, y)
        out.push({ title: `Changed: ${name(y)}`, lines: l.length ? l : ['Reordered or other minor change'] })
      }
    }
    for (const x of a) if (!b.some((o) => o.id === x.id)) out.push({ title: `Removed: ${name(x)}`, lines: [`The ${thing} was removed`] })
    if (!out.length && !same(a.map((x) => x.id), b.map((x) => x.id))) out.push({ title: 'Order changed', lines: [`The ${thing}s were reordered`] })
    return out
  }

  add('Checklist items', entries(before.items, after.items, (x) => x.title, itemLines, 'item'))
  add('Forms', entries(before.forms, after.forms, (x) => x.label, (x, y) => formLines(x, y, before, after), 'form'))
  add(
    'My info details',
    entries(before.fields, after.fields, (x) => x.label, (x, y) => fieldLines({ label: 'Label', type: 'Kind', options: 'Choices', help: 'Help text', sensitive: 'Never saved' }, x as unknown as Record<string, unknown>, y as unknown as Record<string, unknown>), 'detail'),
  )

  const faq: ChangeEntry[] = []
  const fa = before.faq
  const fb = after.faq
  for (let i = 0; i < Math.max(fa.length, fb.length); i++) {
    if (!fa[i]) faq.push({ title: `Added: ${short(fb[i].q)}`, lines: ['New question'] })
    else if (!fb[i]) faq.push({ title: `Removed: ${short(fa[i].q)}`, lines: ['The question was removed'] })
    else if (!same(fa[i], fb[i])) faq.push({ title: `Changed: ${short(fb[i].q)}`, lines: fieldLines({ q: 'Question', a: 'Answer' }, fa[i], fb[i]) })
  }
  add('Questions and answers', faq)

  const sections: ChangeEntry[] = []
  for (const g of after.groups) {
    const old = before.groups.find((o) => o.id === g.id)
    if (old && !same(old, g)) sections.push({ title: `Changed: ${g.title}`, lines: fieldLines({ title: 'Title', intro: 'Introduction' }, old, g) })
  }
  add('Sections', sections)
  return groups
}

export const countChanges = (groups: ChangeGroup[]) => groups.reduce((n, g) => n + g.entries.length, 0)
