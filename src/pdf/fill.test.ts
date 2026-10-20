import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { emptyProfile, type FormId, type Profile } from '../types'
import { ALL_FORMS, fillAll, fillForm, ssnFmt } from './fill'

const load = async (file: string) => new Uint8Array(readFileSync(`public/${file}`))

const sample: Profile = {
  ...emptyProfile,
  firstName: 'Jordan',
  middleName: 'Quinn',
  lastName: 'Testperson',
  dob: '1985-07-04',
  street: '123 Main Street',
  apt: 'Apt 4B',
  city: 'Bethlehem',
  zip: '18015',
  phone: '6105550123',
  email: 'jordan@example.com',
  siteName: 'St. Joseph',
  siteCity: 'Bethlehem',
  locationType: 'Parish',
  gender: 'Female',
  residedInPA: 'yes',
}

const forms: FormId[] = ['bgauth', 'sexabuse', 'conduct', 'social', 'cpsl', 'nsor']

describe('fillForm', () => {
  it.each(forms)('makes a readable PDF for %s, named after the person', async (id) => {
    const { bytes, filename } = await fillForm(id, sample, load)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(0)
    expect(filename).toMatch(/-Testperson-Jordan\.pdf$/)
  })

  it('puts NSOR answers in the right boxes and leaves the SSN blank', async () => {
    const { bytes } = await fillForm('nsor', sample, load)
    const form = (await PDFDocument.load(bytes)).getForm()
    const text = (name: string) => form.getTextField(name).getText() ?? ''
    expect(text('Name')).toBe('Testperson, Jordan Q')
    expect(text('SSN')).toBe('')
    expect(text('DOB')).toBe('07/04/1985')
    expect(text('Phone')).toBe('610-555-0123')
    expect(text('Address')).toBe('123 Main Street, Apt 4B')
    expect(text('Text Field 5')).toBe('Bethlehem, PA 18015') // city, state, ZIP
    expect(text('Text Field 7')).toBe('jordan@example.com') // e-mail
    expect(form.getCheckBox('Check Box 4').isChecked()).toBe(true) // volunteer
    expect(form.getCheckBox('Check Box 1').isChecked()).toBe(false)
  })

  it('copes with names the PDF fonts can’t draw', async () => {
    const p = { ...sample, firstName: 'José', lastName: 'Nguyễn', siteName: 'St. Thérèse “Little Flower”' }
    for (const id of forms) await expect(fillForm(id, p, load)).resolves.toBeTruthy()
  })

  it('still works with nothing filled in', async () => {
    for (const id of forms) await expect(fillForm(id, emptyProfile, load)).resolves.toBeTruthy()
  })
})

// A 1x1 transparent PNG stands in for a drawn signature.
const signature = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))

describe('fillAll', () => {
  it('combines every form into one PDF, one page each', async () => {
    const { bytes, filename } = await fillAll(sample, load)
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(ALL_FORMS.length)
    expect(filename).toBe('volunteer-forms-Testperson-Jordan.pdf')
  })

  it('signs, dates and locks the forms when given a signature', async () => {
    const { bytes, filename } = await fillAll(sample, load, { signed: { signature, date: '10/20/2026' }, ssn: '123456789' })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(ALL_FORMS.length)
    expect(doc.getForm().getFields()).toHaveLength(0) // the NSOR's boxes are flattened into the page
    expect(filename).toBe('volunteer-forms-signed-Testperson-Jordan.pdf')
  })

  it('includes only the chosen forms, in checklist order', async () => {
    const { bytes } = await fillAll(sample, load, {}, ['nsor', 'conduct'])
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2)
  })

  it('leaves the SSN box blank unless one is given, and formats an SSN as XXX-XX-XXXX', async () => {
    const { bytes } = await fillForm('nsor', sample, load)
    const unsigned = (await PDFDocument.load(bytes)).getForm()
    expect(unsigned.getTextField('SSN').getText() ?? '').toBe('')
    expect(ssnFmt('123456789')).toBe('123-45-6789')
    expect(ssnFmt('123-45-6789')).toBe('123-45-6789')
  })
})
