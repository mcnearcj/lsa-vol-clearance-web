import { readFileSync } from 'node:fs'
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib'
import { afterEach, describe, expect, it } from 'vitest'
import { customFields, missingFields } from '../data/formFields'
import { FORMS } from '../data/forms'
import { orderedRequirements } from '../data/requirements'
import { site } from '../data/site'
import { fillForm } from '../pdf/fill'
import { emptyProfile, type Profile } from '../types'
import { applyContent, defaultContent } from './apply'
import { fill, parseRich } from './text'
import { validateContent, type Content } from './schema'

const clone = (): Content => structuredClone(defaultContent)
const load = async (file: string) => new Uint8Array(readFileSync(`public/${file}`))
const person: Profile = { ...emptyProfile, firstName: 'Corey', lastName: 'McNear', dob: '1983-02-15', siteName: 'La Salle Academy', siteCity: 'Shillington', locationType: 'School', phone: '6105551234', extra: { shoe: 'Large' } }

afterEach(() => applyContent(clone()))

/** The drawing commands of a page, decoded, with hex-encoded strings turned back into text. */
async function pageText(bytes: Uint8Array, page = 0): Promise<string> {
  const doc = await PDFDocument.load(bytes)
  const contents = doc.getPage(page).node.Contents()
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents]
  let out = ''
  for (const stream of streams) if (stream instanceof PDFRawStream) out += Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1')
  return out.replace(/<([0-9A-Fa-f]+)>/g, (_, h: string) => Buffer.from(h, 'hex').toString('latin1'))
}

describe('validateContent', () => {
  it('accepts the built-in settings', () => {
    const r = validateContent(clone())
    expect(r.ok, JSON.stringify(r)).toBe(true)
  })
  it('rejects things that would break or endanger the site', () => {
    const bad = (mutate: (c: Content) => void) => {
      const c = clone()
      mutate(c)
      return validateContent(c)
    }
    expect(bad((c) => (c.school.name = '')).ok).toBe(false)
    expect(bad((c) => (c.items[0].links[0].href = 'javascript:alert(1)')).ok).toBe(false)
    expect(bad((c) => (c.items[1].id = c.items[0].id)).ok).toBe(false)
    expect(bad((c) => (c.items[0].group = 'nope')).ok).toBe(false)
    expect(bad((c) => (c.checklist.file = '../secret.pdf')).ok).toBe(false)
    expect(bad((c) => (c.checklist.file = 'https://evil.example/x.pdf')).ok).toBe(false)
    expect(bad((c) => (c.forms[0].kind = 'download')).ok).toBe(true) // a built-in form can be turned into a print-only one
    expect(bad((c) => ((c.forms[0] as { kind: string }).kind = 'weird')).ok).toBe(false)
    expect(bad((c) => (c.forms[0].id = 'madeup')).ok).toBe(false) // built-in kind with a made-up id
    expect(validateContent({ nonsense: true }).ok).toBe(false)
    expect(validateContent(null).ok).toBe(false)
  })
  it('accepts a school-added print-only form with just a source address', () => {
    const c = clone()
    c.forms.push({ id: 'driver', kind: 'download', label: 'Driver form', handIn: 'Driver form', handTo: 'lsec', sourceUrl: 'https://example.org/driver.pdf' })
    expect(validateContent(c).ok).toBe(true)
    c.forms.push({ id: 'broken', kind: 'fillable', label: 'x', handIn: 'x', handTo: 'lsec', file: 'data/forms/x.pdf' })
    expect(validateContent(c).ok).toBe(false) // fillable needs its mapping
  })
})

describe('applyContent', () => {
  it('updates the school, coordinator and placeholders in the text', () => {
    const c = clone()
    c.school.name = 'Test Academy'
    c.lsec = { name: 'Pat Example', email: 'pat@example.org' }
    applyContent(c)
    expect(site.schoolName).toBe('Test Academy')
    expect(fill('Ask {lsec} at {lsecEmail} about {school}.')).toBe('Ask Pat Example at pat@example.org about Test Academy.')
  })
  it('shows added items and forms and drops removed ones', () => {
    const c = clone()
    c.items = c.items.filter((r) => r.id !== 'mvr')
    c.forms.push({ id: 'extra', kind: 'download', label: 'Extra', handIn: 'Extra form', handTo: 'lsec', sourceUrl: 'https://example.org/e.pdf' })
    applyContent(c)
    expect(orderedRequirements.find((r) => r.id === 'mvr')).toBeUndefined()
    expect(FORMS.some((f) => f.id === 'extra')).toBe(true)
  })
  it('warns about blanks in the school’s own details, but not sensitive ones', () => {
    const c = clone()
    c.fields = [
      { id: 'shoe', label: 'Shoe size', type: 'text' },
      { id: 'badge', label: 'Badge number', type: 'text', sensitive: true },
    ]
    c.forms.push({
      id: 'locker',
      kind: 'placed',
      label: 'Locker form',
      handIn: 'Locker form',
      handTo: 'lsec',
      file: 'forms/code-of-conduct-acknowledgement.pdf',
      placements: [
        { page: 0, x: 100, y: 100, w: 100, h: 14, source: { kind: 'field', field: 'shoe' } },
        { page: 0, x: 100, y: 130, w: 100, h: 14, source: { kind: 'field', field: 'badge' } },
      ],
    })
    applyContent(c)
    expect(customFields.map((f) => f.id)).toEqual(['shoe', 'badge'])
    expect(missingFields(['locker'], { ...person, extra: {} })).toEqual(['Shoe size'])
    expect(missingFields(['locker'], person)).toEqual([])
  })
})

describe('school text', () => {
  it('never turns text into HTML, and refuses unsafe links', () => {
    const [para] = parseRich('<script>alert(1)</script> **bold** [ok](https://example.org) [bad](javascript:alert(1)) [pdf](forms/x.pdf) [up](../x)')
    expect(para.find((p) => p.type === 'text' && p.text.includes('<script>'))).toBeTruthy()
    const links = para.filter((p) => p.type === 'link')
    expect(links.map((l) => (l as { href: string }).href)).toEqual(['https://example.org', `${import.meta.env.BASE_URL}forms/x.pdf`])
    expect(para.some((p) => p.type === 'text' && p.text === 'bad')).toBe(true)
  })
  it('splits paragraphs on blank lines', () => {
    expect(parseRich('One\n\nTwo')).toHaveLength(2)
  })
})

describe('forms the school adds', () => {
  it('fills a PDF with fields from a mapping', async () => {
    const c = clone()
    c.forms.push({
      id: 'nsor2',
      kind: 'fillable',
      label: 'NSOR copy',
      handIn: 'x',
      handTo: 'state',
      file: 'forms/nsor-application.pdf',
      mapping: { Name: { kind: 'name' }, DOB: { kind: 'field', field: 'dob' }, Phone: { kind: 'field', field: 'phone' }, Address: { kind: 'text', text: 'Fixed words' } },
    })
    applyContent(c)
    const { bytes, filename } = await fillForm('nsor2', person, load)
    expect(filename).toMatch(/^nsor2-McNear-Corey\.pdf$/)
    const form = (await PDFDocument.load(bytes)).getForm()
    expect(form.getTextField('Name').getText()).toBe('Corey McNear')
    expect(form.getTextField('DOB').getText()).toBe('02/15/1983')
    expect(form.getTextField('Phone').getText()).toBe('610-555-1234')
    expect(form.getTextField('Address').getText()).toBe('Fixed words')
  })

  it('draws placed boxes: text, and marks only when the choice matches', async () => {
    const c = clone()
    c.forms.push({
      id: 'placed1',
      kind: 'placed',
      label: 'Placed',
      handIn: 'x',
      handTo: 'lsec',
      file: 'forms/code-of-conduct-acknowledgement.pdf',
      placements: [
        { page: 0, x: 100, y: 600, w: 200, h: 14, source: { kind: 'name' } },
        { page: 0, x: 100, y: 630, w: 100, h: 14, source: { kind: 'field', field: 'siteName' } },
        { page: 0, x: 50, y: 660, w: 10, h: 10, source: { kind: 'text', text: '' }, mark: 'x', when: { field: 'locationType', equals: 'school' } },
        { page: 0, x: 50, y: 680, w: 10, h: 10, source: { kind: 'text', text: '' }, mark: 'x', when: { field: 'locationType', equals: 'Parish' } },
      ],
    })
    applyContent(c)
    const { bytes } = await fillForm('placed1', person, load)
    const drawn = await pageText(bytes)
    expect(drawn).toContain('Corey McNear')
    expect(drawn).toContain('La Salle Academy')
    expect(drawn.match(/\(X\)|X Tj/g)?.length ?? drawn.split('X').length - 1).toBeGreaterThan(0)
  })

  it('doesn’t fill a print-only form', async () => {
    const c = clone()
    c.forms.push({ id: 'print1', kind: 'download', label: 'Print me', handIn: 'x', handTo: 'lsec', sourceUrl: 'https://example.org/p.pdf' })
    applyContent(c)
    await expect(fillForm('print1', person, load)).rejects.toThrow(/not one the site fills in/)
  })
})
