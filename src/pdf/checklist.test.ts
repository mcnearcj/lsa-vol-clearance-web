import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { submissionChecklist } from '../data/submission'
import { makeChecklistPdf } from './checklist'

const info = { schoolName: 'La Salle Academy', lsec: { name: 'Jeanie Hauck', email: 'hauck@lsabear.com' }, date: '10/20/2026', basedOn: 'School Volunteer Requirements Checklist, revised 7/31/2025' }

describe('makeChecklistPdf', () => {
  it('fits the full checklist, driver section included, on one page', async () => {
    const doc = await PDFDocument.load(await makeChecklistPdf({ ...info, sections: submissionChecklist() }))
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe('Volunteer clearance checklist')
  })

  it('carries on to more pages instead of failing when the school adds a lot', async () => {
    const sections = submissionChecklist()
    sections[2].items.push(...Array.from({ length: 40 }, (_, i) => ({ label: `Extra item number ${i + 1} to hand in`, detail: 'Some extra detail about this item' })))
    const doc = await PDFDocument.load(await makeChecklistPdf({ ...info, sections }))
    expect(doc.getPageCount()).toBeGreaterThan(1)
  })
})
