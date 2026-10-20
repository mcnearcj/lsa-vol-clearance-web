import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { SubmissionSection } from '../data/submission'

// Draws the volunteer's submission checklist as a one- or two-page PDF.

const W = 612
const H = 792
const M = 60
const INK = rgb(0.1, 0.12, 0.18)
const MUTED = rgb(0.38, 0.42, 0.5)
const OK = rgb(0.11, 0.48, 0.3)
const BAND = rgb(0.12, 0.23, 0.41)

/** Standard PDF fonts only handle Latin-1. */
const clean = (t: string) =>
  t
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of clean(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

export interface ChecklistInfo {
  name: string
  schoolName: string
  lsec: { name: string; email: string }
  date: string
  sections: SubmissionSection[]
}

export async function makeChecklistPdf(info: ChecklistInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Submission checklist - ${info.name || 'volunteer'}`)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold)

  let page: PDFPage = doc.addPage([W, H])
  let y = 0 // distance from the top of the page
  const text = (t: string, x: number, size: number, font: PDFFont, color = INK) => page.drawText(clean(t), { x, y: H - y, size, font, color })
  // A band on every page, so each one reads as "for you" at a glance even if the pages get separated.
  const band = () => {
    page.drawRectangle({ x: 0, y: H - 40, width: W, height: 40, color: BAND })
    page.drawText("FOR YOU TO KEEP. DON'T HAND THIS PAGE IN.", { x: M, y: H - 25, size: 10.5, font: bold, color: rgb(1, 1, 1) })
  }
  const ensure = (needed: number) => {
    if (y + needed <= H - 56) return
    page = doc.addPage([W, H])
    band()
    y = 72
  }

  band()
  y = 80
  text('Submission checklist', M, 22, serif)
  y += 19
  text([info.name, info.schoolName, `Printed ${info.date}`].filter(Boolean).join('  ·  ').replace(/·/g, '-'), M, 11, regular, MUTED)
  y += 19
  for (const line of wrap(regular, `Gather everything below, then give it to ${info.lsec.name}, ${info.schoolName}'s Local Safe Environment Coordinator (${info.lsec.email}). Ticked boxes are done.`, 10.5, W - 2 * M)) {
    text(line, M, 10.5, regular)
    y += 14
  }
  y += 6

  for (const section of info.sections) {
    ensure(60)
    page.drawLine({ start: { x: M, y: H - y + 4 }, end: { x: W - M, y: H - y + 4 }, thickness: 0.6, color: rgb(0.8, 0.83, 0.88) })
    y += 16
    text(section.intro ? `${section.title}  ` : section.title, M, 13, bold)
    if (section.intro) text(section.intro, M + bold.widthOfTextAtSize(clean(`${section.title}  `), 13), 10, regular, MUTED)
    y += 10
    for (const item of section.items) {
      const labelLines = wrap(bold, item.label, 11, W - 2 * M - 30)
      const detailLines = item.detail ? wrap(regular, item.detail, 9.5, W - 2 * M - 30) : []
      ensure(labelLines.length * 13 + detailLines.length * 11 + 20)
      y += 12
      // Checkbox, ticked when the site knows it's done.
      const top = y - 10
      page.drawRectangle({ x: M, y: H - top - 12, width: 12, height: 12, borderColor: INK, borderWidth: 1 })
      if (item.done) {
        page.drawLine({ start: { x: M + 2.5, y: H - top - 6 }, end: { x: M + 5.2, y: H - top - 9.5 }, thickness: 1.6, color: OK })
        page.drawLine({ start: { x: M + 5.2, y: H - top - 9.5 }, end: { x: M + 10.5, y: H - top - 2.5 }, thickness: 1.6, color: OK })
      }
      for (const line of labelLines) {
        text(line, M + 22, 10.5, bold)
        y += 12.5
      }
      text(item.status, M + 22, 9.5, regular, item.done ? OK : MUTED)
      y += 11
      for (const line of detailLines) {
        text(line, M + 22, 9, regular, MUTED)
        y += 11
      }
    }
    y += 14
  }

  const pages = doc.getPages()
  pages.forEach((pg, i) =>
    pg.drawText(clean(`Made with Volunteer Clearances, not an official diocesan document.${pages.length > 1 ? `  Page ${i + 1} of ${pages.length}` : ''}`), {
      x: M,
      y: 34,
      size: 8,
      font: regular,
      color: MUTED,
    }),
  )
  return doc.save()
}
