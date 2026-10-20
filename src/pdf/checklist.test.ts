import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { submissionChecklist } from '../data/submission'
import { makeChecklistPdf } from './checklist'

const info = { name: 'Jordan Alexander Example-Longname', schoolName: 'La Salle Academy', lsec: { name: 'Jeanie Hauck', email: 'hauck@lsabear.com' }, date: '10/20/2026' }

describe('makeChecklistPdf', () => {
  it('fits the full checklist, driver section included, on one page', async () => {
    const sections = submissionChecklist({ patch: { status: 'done', completedOn: '2022-01-05' } }, { forms: ['sexabuse', 'conduct'] })
    const doc = await PDFDocument.load(await makeChecklistPdf({ ...info, sections }))
    expect(doc.getPageCount()).toBe(1)
  })
})
