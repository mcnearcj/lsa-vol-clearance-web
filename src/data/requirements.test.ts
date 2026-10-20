import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptyProfile, type FormId } from '../types'
import { formFields, missingFields } from './formFields'
import { FORMS } from './forms'
import { groups, orderedRequirements, requirements } from './requirements'

describe('checklist data', () => {
  it('covers all 12 of the diocese’s items between the tracked items and the forms', () => {
    const numbers = new Set([...requirements.map((r) => r.number), ...FORMS.map((f) => f.number)])
    expect([...numbers].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(new Set(requirements.map((r) => r.id)).size).toBe(requirements.length)
  })
  it('puts every item in a known group, and shows all of them', () => {
    const ids = new Set(groups.map((g) => g.id))
    for (const r of requirements) expect(ids.has(r.group), r.id).toBe(true)
    expect(orderedRequirements).toHaveLength(requirements.length)
  })
  it('links only to PDFs that exist in public/forms', () => {
    for (const r of requirements) for (const ref of r.references ?? []) expect(existsSync(`public/${ref.file}`), ref.file).toBe(true)
  })
  it('knows which fields every form uses', () => {
    for (const f of FORMS) expect(formFields[f.id as FormId].length, f.id).toBeGreaterThan(0)
  })
})

describe('missingFields', () => {
  it('lists blanks by their on-screen names', () => {
    expect(missingFields(['sexabuse'], { ...emptyProfile, siteName: '', siteCity: '' })).toEqual(['First name', 'Last name', 'Parish or school', 'Parish or school city'])
  })
  it('is empty once everything a form uses is filled in', () => {
    expect(missingFields(['sexabuse'], { ...emptyProfile, firstName: 'A', lastName: 'B', siteName: 'St. Joseph', siteCity: 'Bethlehem' })).toEqual([])
    expect(missingFields(['sexabuse', 'nsor'], { ...emptyProfile, firstName: 'A', lastName: 'B', siteName: 'St. Joseph', siteCity: 'Bethlehem' })).toContain('Date of birth')
  })
})

describe('ssnOnAuthorization', () => {
  it('puts the SSN on the authorization form only for employees, never for volunteers or a blank role', async () => {
    const { ssnOnAuthorization } = await import('../types')
    expect(ssnOnAuthorization({ ...emptyProfile, position: 'Volunteer' })).toBe(false)
    expect(ssnOnAuthorization({ ...emptyProfile, position: '' })).toBe(false)
    expect(ssnOnAuthorization({ ...emptyProfile, position: 'Employee' })).toBe(true)
  })
})

describe('ssnAsTyped', () => {
  it('adds dashes as digits are typed, whether or not the person types them', async () => {
    const { ssnAsTyped } = await import('../ssn')
    expect(['1', '123', '1234', '12345', '123456', '123456789'].map(ssnAsTyped)).toEqual(['1', '123', '123-4', '123-45', '123-45-6', '123-45-6789'])
    expect(ssnAsTyped('123-45-6789')).toBe('123-45-6789')
    expect(ssnAsTyped('123-')).toBe('123') // backspacing over a dash
    expect(ssnAsTyped('123 45 6789 0')).toBe('123-45-6789') // spaces and extra digits ignored
  })
})

describe('diocesan schools', () => {
  it('finds a school by name, ignoring case and extra spaces', async () => {
    const { findSchool } = await import('./schools')
    expect(findSchool(' la salle academy ')).toEqual({ name: 'La Salle Academy', city: 'Shillington' })
    expect(findSchool('St. Joseph')).toBeUndefined()
  })
})
