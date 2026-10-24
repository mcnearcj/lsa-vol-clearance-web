import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { SubmissionSection } from '../data/submission'

// Draws the printable checklist as a one-page PDF: empty boxes, and lines to write a name and date on.

const W = 612
const H = 792
const INK = rgb(0.1, 0.12, 0.18)
const MUTED = rgb(0.38, 0.42, 0.5)
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
  schoolName: string
  lsec: { name: string; email: string }
  date: string
  /** The diocese document the list follows, shown in small print ('' to leave out). */
  basedOn?: string
  sections: SubmissionSection[]
}

export async function makeChecklistPdf(info: ChecklistInfo): Promise<Uint8Array> {
  // Draw at full size, and shrink until everything fits on one page.
  for (let scale = 1; ; scale -= 0.05) {
    const doc = await draw(info, scale)
    if (doc.getPageCount() === 1 || scale <= 0.7) return doc.save()
  }
}

async function draw(info: ChecklistInfo, s: number): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  doc.setTitle('Volunteer clearance checklist')
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold)
  const M = 54
  const right = W - M

  let page: PDFPage = doc.addPage([W, H])
  let y = 0 // distance from the top of the page
  const text = (t: string, x: number, size: number, font: PDFFont, color = INK) => page.drawText(clean(t), { x, y: H - y, size, font, color })
  // A band on every page, so each one reads as "for you" at a glance even if the pages get separated.
  const band = () => {
    page.drawRectangle({ x: 0, y: H - 36, width: W, height: 36, color: BAND })
    page.drawText("FOR YOU TO KEEP. DON'T HAND THIS PAGE IN.", { x: M, y: H - 23, size: 10.5, font: bold, color: rgb(1, 1, 1) })
  }
  const ensure = (needed: number) => {
    if (y + needed <= H - 48) return
    page = doc.addPage([W, H])
    band()
    y = 64
  }
  const para = (t: string, size: number, font: PDFFont, color = INK) => {
    for (const line of wrap(font, t, size * s, right - M)) {
      text(line, M, size * s, font, color)
      y += (size + 3.5) * s
    }
  }

  band()
  y = 70
  text('Volunteer clearance checklist', M, 22 * s, serif)
  y += 18 * s
  text([info.schoolName, 'Diocese of Allentown', `Printed ${info.date}`].filter(Boolean).join('  -  '), M, 11 * s, regular, MUTED)
  y += 26 * s
  // Lines to write on: this page holds nothing about the person.
  const line = (label: string, x: number, w: number) => {
    text(label, x, 10.5 * s, bold)
    const from = x + bold.widthOfTextAtSize(label, 10.5 * s) + 6
    page.drawLine({ start: { x: from, y: H - y - 2 }, end: { x: x + w, y: H - y - 2 }, thickness: 0.6, color: MUTED })
  }
  line('Name', M, 300)
  line('Date', M + 330, right - M - 330)
  y += 22 * s
  para(`Check off each item as you finish it, then give everything to ${info.lsec.name}, ${info.schoolName}'s Local Safe Environment Coordinator (${info.lsec.email}). Your coordinator has the final word on what you need.`, 10.5, regular)
  if (info.basedOn) {
    y += 2 * s
    para(`Follows the Diocese of Allentown's ${info.basedOn}.`, 9.5, regular, MUTED)
  }
  y += 4 * s

  for (const section of info.sections) {
    ensure(50 * s)
    page.drawLine({ start: { x: M, y: H - y + 4 }, end: { x: right, y: H - y + 4 }, thickness: 0.6, color: rgb(0.8, 0.83, 0.88) })
    y += 15 * s
    text(section.intro ? `${section.title}  ` : section.title, M, 12.5 * s, bold)
    if (section.intro) text(section.intro, M + bold.widthOfTextAtSize(clean(`${section.title}  `), 12.5 * s), 9.5 * s, regular, MUTED)
    y += 6 * s
    for (const item of section.items) {
      const textW = right - M - 22
      const labelLines = wrap(bold, item.label, 10.5 * s, textW)
      const detailLines = item.detail ? wrap(regular, item.detail, 9 * s, textW) : []
      ensure((labelLines.length * 12.5 + detailLines.length * 10.5 + 10) * s)
      y += 12 * s
      const box = 11 * s
      const top = y - 9.5 * s
      page.drawRectangle({ x: M, y: H - top - box, width: box, height: box, borderColor: INK, borderWidth: 1 })
      labelLines.forEach((l, i) => {
        text(l, M + 22, 10.5 * s, bold)
        if (i < labelLines.length - 1) y += 12.5 * s
      })
      for (const l of detailLines) {
        y += 10.5 * s
        text(l, M + 22, 9 * s, regular, MUTED)
      }
      y += 3 * s
    }
    y += 12 * s
  }

  const pages = doc.getPages()
  pages.forEach((pg, i) =>
    pg.drawText(clean(`Not an official diocesan document.${pages.length > 1 ? `  Page ${i + 1} of ${pages.length}` : ''}`), {
      x: M,
      y: 28,
      size: 8,
      font: regular,
      color: MUTED,
    }),
  )
  return doc
}
