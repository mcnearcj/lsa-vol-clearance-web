import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptyProfile, type FormId } from '../types'
import { formFields, missingFields } from './formFields'
import { groups, orderedRequirements, requirements } from './requirements'

describe('checklist data', () => {
  it('has the diocese’s 12 items, numbered 1–12, with unique ids', () => {
    expect(requirements.map((r) => r.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
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
  it('knows which fields every fillable form uses', () => {
    for (const r of requirements) if (r.form) expect(formFields[r.form.id as FormId].length, r.id).toBeGreaterThan(0)
  })
})

describe('missingFields', () => {
  it('lists blanks by their on-screen names', () => {
    expect(missingFields('sexabuse', emptyProfile)).toEqual(['First name', 'Last name', 'Parish or school', 'Parish or school city'])
  })
  it('is empty once everything a form uses is filled in', () => {
    expect(missingFields('sexabuse', { ...emptyProfile, firstName: 'A', lastName: 'B', siteName: 'St. Joseph', siteCity: 'Bethlehem' })).toEqual([])
  })
})
