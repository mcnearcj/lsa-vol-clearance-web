import type { FormInfo, FormKind } from '../data/forms'
import type { Requirement } from '../types'

// The shape of data/content.json: everything the school can change without a rebuild. The editor writes it, the site
// reads it, and anything that doesn't validate is ignored so the public site keeps working on the built-in settings.

export const BUILT_IN_FORM_IDS = ['sexabuse', 'conduct', 'social', 'cpsl', 'bgauth', 'nsor']

/** What goes in a spot on a form (a PDF field or a placed box). */
export type FieldSource =
  | { kind: 'field'; field: string } // a "My info" detail: a built-in key or a custom field id
  | { kind: 'name' } // the full name as typed
  | { kind: 'date' } // today's date (MM/DD/YYYY)
  | { kind: 'signature' } // the signature image (only when signing on screen)
  | { kind: 'ssn' } // the SSN, if the person typed one for this download
  | { kind: 'text'; text: string } // fixed text

/** A box on a `placed` form, in PDF points measured from the top-left of the page. */
export interface Placement {
  page: number // 0-based
  x: number
  y: number
  w: number
  h: number
  source: FieldSource
  /** Only draw when this detail equals this value, for marks like "Location type = School". */
  when?: { field: string; equals: string }
  /** Draw a mark instead of text. */
  mark?: 'x' | 'dot'
  size?: number
}

export type FieldType = 'text' | 'date' | 'choice' | 'yesno'

export interface CustomField {
  id: string
  label: string
  type: FieldType
  options?: string[]
  help?: string
  /** Asked only when making the files and never saved, like the SSN. */
  sensitive?: boolean
}

export interface FaqEntry {
  q: string
  a: string
}

export interface Group {
  id: string
  title: string
  intro: string
}

export interface Content {
  version: 1
  school: { name: string; tagline?: string; homeUrl?: string; logoUrl?: string; address?: string; phone?: string }
  lsec: { name: string; email: string }
  diocese: { name: string; title: string; address: string; phone: string; email: string }
  checklist: {
    name: string
    revised: string
    file: string
    requirementsUrl: string
    limitedUrl: string
    policiesUrl: string
    checkedOn: string
  }
  groups: Group[]
  items: Requirement[]
  forms: FormInfo[]
  fields: CustomField[]
  faq: FaqEntry[]
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

const KINDS: FormKind[] = ['built-in', 'download', 'fillable', 'placed']

/** Web links the site will open. Anything else (javascript:, data:, relative paths) is refused. */
export const isWebUrl = (s: unknown): s is string => typeof s === 'string' && /^https?:\/\/[^\s]+$/i.test(s)
/** A PDF shipped with the site or uploaded with the content: only under forms/ or data/, never a scheme or `..`. */
export const isSitePdf = (s: unknown): s is string => typeof s === 'string' && /^(forms|data)\/[A-Za-z0-9._\-/ ]+\.pdf$/i.test(s) && !s.includes('..')
const isDate = (s: unknown) => s === '' || (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s))
const isId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(s)

export function validateContent(raw: unknown): { ok: true; content: Content } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const bad = (where: string, why: string) => errors.push(`${where}: ${why}`)
  const str = (o: Obj, k: string, where: string, required = true): string => {
    const v = o[k]
    if (typeof v !== 'string') {
      if (required || v !== undefined) bad(`${where}.${k}`, 'must be text')
      return ''
    }
    if (required && !v.trim()) bad(`${where}.${k}`, 'can’t be empty')
    return v
  }
  const arr = (v: unknown, where: string): unknown[] => {
    if (!Array.isArray(v)) {
      bad(where, 'must be a list')
      return []
    }
    return v
  }
  const url = (o: Obj, k: string, where: string, required = true) => {
    const v = o[k]
    if (v === undefined || v === '') {
      if (required) bad(`${where}.${k}`, 'needs a web address')
    } else if (!isWebUrl(v)) bad(`${where}.${k}`, 'must be a web address starting with http:// or https://')
  }

  if (!isObj(raw)) return { ok: false, errors: ['The file isn’t a settings file.'] }
  if (raw.version !== 1) bad('version', 'must be 1')

  const school = isObj(raw.school) ? raw.school : {}
  str(school, 'name', 'school')
  for (const k of ['tagline', 'address', 'phone']) str(school, k, 'school', false)
  for (const k of ['homeUrl', 'logoUrl']) url(school, k, 'school', false)
  const lsec = isObj(raw.lsec) ? raw.lsec : {}
  str(lsec, 'name', 'lsec')
  str(lsec, 'email', 'lsec')
  const diocese = isObj(raw.diocese) ? raw.diocese : {}
  for (const k of ['name', 'title', 'address', 'phone', 'email']) str(diocese, k, 'diocese', false)

  const cl = isObj(raw.checklist) ? raw.checklist : {}
  str(cl, 'name', 'checklist')
  str(cl, 'revised', 'checklist', false)
  if (!isSitePdf(cl.file)) bad('checklist.file', 'must be a PDF under forms/ or data/')
  for (const k of ['requirementsUrl', 'limitedUrl', 'policiesUrl']) url(cl, k, 'checklist', false)
  if (!isDate(cl.checkedOn ?? '')) bad('checklist.checkedOn', 'must be a date like 2026-10-24')

  const groupIds = new Set<string>()
  arr(raw.groups, 'groups').forEach((g, i) => {
    const w = `groups[${i}]`
    if (!isObj(g)) return bad(w, 'must be an object')
    if (!isId(g.id)) bad(`${w}.id`, 'needs a short id')
    else groupIds.add(g.id)
    str(g, 'title', w)
    str(g, 'intro', w, false)
  })

  const itemIds = new Set<string>()
  const formIds = new Set<string>()
  const forms = arr(raw.forms, 'forms')
  forms.forEach((f) => isObj(f) && typeof f.id === 'string' && formIds.add(f.id))

  arr(raw.items, 'items').forEach((it, i) => {
    const w = `items[${i}]`
    if (!isObj(it)) return bad(w, 'must be an object')
    if (!isId(it.id)) bad(`${w}.id`, 'needs a short id')
    else if (itemIds.has(it.id)) bad(`${w}.id`, 'is used twice')
    else itemIds.add(it.id)
    if (typeof it.number !== 'number') bad(`${w}.number`, 'must be a number')
    if (typeof it.group !== 'string' || !groupIds.has(it.group)) bad(`${w}.group`, 'must be one of the groups')
    str(it, 'title', w)
    str(it, 'summary', w, false)
    str(it, 'handIn', w)
    str(it, 'handInDetail', w, false)
    str(it, 'time', w, false)
    str(it, 'note', w, false)
    if (it.validYears !== undefined && (typeof it.validYears !== 'number' || it.validYears < 1 || it.validYears > 50)) bad(`${w}.validYears`, 'must be a number of years')
    if (it.optional !== undefined && typeof it.optional !== 'boolean') bad(`${w}.optional`, 'must be yes or no')
    if (it.form !== undefined && (typeof it.form !== 'string' || !formIds.has(it.form))) bad(`${w}.form`, 'must be one of the forms')
    arr(it.links ?? [], `${w}.links`).forEach((l, j) => {
      if (!isObj(l)) return bad(`${w}.links[${j}]`, 'must be an object')
      str(l, 'label', `${w}.links[${j}]`)
      url(l, 'href', `${w}.links[${j}]`)
    })
    arr(it.steps ?? [], `${w}.steps`).forEach((s, j) => typeof s !== 'string' && bad(`${w}.steps[${j}]`, 'must be text'))
    if (it.references !== undefined)
      arr(it.references, `${w}.references`).forEach((r, j) => {
        if (!isObj(r)) return bad(`${w}.references[${j}]`, 'must be an object')
        str(r, 'label', `${w}.references[${j}]`)
        if (!isSitePdf(r.file)) bad(`${w}.references[${j}].file`, 'must be a PDF under forms/ or data/')
      })
  })

  const fieldIds = new Set<string>()
  arr(raw.fields ?? [], 'fields').forEach((f, i) => {
    const w = `fields[${i}]`
    if (!isObj(f)) return bad(w, 'must be an object')
    if (!isId(f.id)) bad(`${w}.id`, 'needs a short id')
    else if (fieldIds.has(f.id)) bad(`${w}.id`, 'is used twice')
    else fieldIds.add(f.id)
    str(f, 'label', w)
    if (!['text', 'date', 'choice', 'yesno'].includes(f.type as string)) bad(`${w}.type`, 'must be text, date, choice or yesno')
    if (f.type === 'choice' && (!Array.isArray(f.options) || f.options.length === 0 || f.options.some((o) => typeof o !== 'string' || !o))) bad(`${w}.options`, 'needs at least one choice')
    str(f, 'help', w, false)
  })

  const source = (s: unknown, w: string) => {
    if (!isObj(s)) return bad(w, 'must say what goes here')
    if (s.kind === 'field') {
      if (typeof s.field !== 'string' || !s.field) bad(`${w}.field`, 'must name a detail')
    } else if (s.kind === 'text') {
      if (typeof s.text !== 'string') bad(`${w}.text`, 'must be text')
    } else if (!['name', 'date', 'signature', 'ssn'].includes(s.kind as string)) bad(`${w}.kind`, 'isn’t something the site can fill')
  }
  const seenForm = new Set<string>()
  forms.forEach((f, i) => {
    const w = `forms[${i}]`
    if (!isObj(f)) return bad(w, 'must be an object')
    if (!isId(f.id)) bad(`${w}.id`, 'needs a short id')
    else if (seenForm.has(f.id)) bad(`${w}.id`, 'is used twice')
    else seenForm.add(f.id as string)
    if (!KINDS.includes(f.kind as FormKind)) bad(`${w}.kind`, 'must be built-in, download, fillable or placed')
    if (f.kind === 'built-in' && !BUILT_IN_FORM_IDS.includes(f.id as string)) bad(`${w}.id`, 'isn’t one of the built-in forms')
    if (f.number !== undefined && typeof f.number !== 'number') bad(`${w}.number`, 'must be a number')
    str(f, 'label', w)
    str(f, 'handIn', w)
    str(f, 'handInDetail', w, false)
    str(f, 'note', w, false)
    if (f.handTo !== 'lsec' && f.handTo !== 'state') bad(`${w}.handTo`, 'must be lsec or state')
    url(f, 'sourceUrl', w, false)
    url(f, 'policy', w, false)
    if (f.copiedOn !== undefined && !isDate(f.copiedOn)) bad(`${w}.copiedOn`, 'must be a date')
    if (f.kind === 'download') {
      if (f.file === undefined && !isWebUrl(f.sourceUrl)) bad(`${w}`, 'needs a PDF or a source web address')
    } else if (f.kind !== 'built-in' && !isSitePdf(f.file)) bad(`${w}.file`, 'must be a PDF under forms/ or data/')
    if (f.file !== undefined && !isSitePdf(f.file)) bad(`${w}.file`, 'must be a PDF under forms/ or data/')
    if (f.kind === 'fillable') {
      if (!isObj(f.mapping)) bad(`${w}.mapping`, 'needs a list of what each PDF field gets')
      else for (const [k, v] of Object.entries(f.mapping)) source(v, `${w}.mapping.${k}`)
    }
    if (f.kind === 'placed') {
      arr(f.placements, `${w}.placements`).forEach((p, j) => {
        const pw = `${w}.placements[${j}]`
        if (!isObj(p)) return bad(pw, 'must be an object')
        for (const k of ['page', 'x', 'y', 'w', 'h']) if (typeof p[k] !== 'number' || !Number.isFinite(p[k] as number)) bad(`${pw}.${k}`, 'must be a number')
        if (typeof p.w === 'number' && p.w <= 0) bad(`${pw}.w`, 'must be bigger than zero')
        if (typeof p.h === 'number' && p.h <= 0) bad(`${pw}.h`, 'must be bigger than zero')
        source(p.source, `${pw}.source`)
        if (p.mark !== undefined && p.mark !== 'x' && p.mark !== 'dot') bad(`${pw}.mark`, 'must be x or dot')
        if (p.when !== undefined && (!isObj(p.when) || typeof p.when.field !== 'string' || typeof p.when.equals !== 'string')) bad(`${pw}.when`, 'needs a detail and a value')
      })
    }
  })

  arr(raw.faq ?? [], 'faq').forEach((q, i) => {
    if (!isObj(q)) return bad(`faq[${i}]`, 'must be an object')
    str(q, 'q', `faq[${i}]`)
    str(q, 'a', `faq[${i}]`)
  })

  return errors.length ? { ok: false, errors } : { ok: true, content: raw as unknown as Content }
}
