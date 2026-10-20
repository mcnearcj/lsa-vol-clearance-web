import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { ssnOnAuthorization, type FormId, type Profile } from '../types'

// All filling happens in the browser. Nothing is uploaded anywhere.
// Coordinates below are PDF points measured from the TOP-left of the page (converted when drawing),
// taken from the text positions in the diocese's own PDFs.

export type LoadBytes = (file: string) => Promise<Uint8Array>

/**
 * Extras for one download. Neither the signature nor the SSN is ever stored: they're passed in and drawn straight
 * onto the PDFs.
 */
export interface FillOptions {
  /** Signed on screen: the signature (PNG, transparent background) and the date to write beside it (MM/DD/YYYY). */
  signed?: { signature: Uint8Array; date: string }
  /** Social Security Number. Used on the NSOR application (and the authorization form for employees). */
  ssn?: string
  /** Lock the forms' fill-in boxes into the page (needed when combining forms into one file). */
  flatten?: boolean
}

const INK = rgb(0.05, 0.1, 0.45)

/** Standard PDF fonts only handle Latin-1; swap anything else for "?" rather than crash. */
function clean(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
}

function fullName(p: Profile): string {
  return [p.firstName, p.middleName, p.lastName].map((s) => s.trim()).filter(Boolean).join(' ')
}

function location(p: Profile): string {
  return [p.siteName.trim(), p.siteCity.trim()].filter(Boolean).join(', ')
}

/** Draws `text` with its baseline `y` points from the top of the page, shrinking to fit `maxWidth`. */
function put(page: PDFPage, font: PDFFont, text: string, x: number, y: number, maxWidth?: number, size = 10) {
  const t = clean(text)
  if (!t) return
  let s = size
  if (maxWidth) {
    while (s > 6 && font.widthOfTextAtSize(t, s) > maxWidth) s -= 0.5
  }
  page.drawText(t, { x, y: page.getHeight() - y, size: s, font, color: INK })
}

/** Marks a printed "O" radio glyph or blank with an X / dot. `cx`,`cy` are the centre, from the top. */
function dot(page: PDFPage, cx: number, cy: number) {
  page.drawCircle({ x: cx, y: page.getHeight() - cy, size: 3.2, color: INK })
}

function check(page: PDFPage, font: PDFFont, cx: number, cy: number) {
  const s = 11
  const w = font.widthOfTextAtSize('X', s)
  page.drawText('X', { x: cx - w / 2, y: page.getHeight() - cy - s * 0.35, size: s, font, color: INK })
}

/** Draws the signature inside a box (top-left corner, from the top of the page), sitting on the line at the bottom. */
async function drawSignature(doc: PDFDocument, page: PDFPage, png: Uint8Array, box: { x: number; top: number; w: number; h: number }) {
  const img = await doc.embedPng(png)
  const scale = Math.min(box.w / img.width, box.h / img.height)
  const w = img.width * scale
  const h = img.height * scale
  page.drawImage(img, { x: box.x, y: page.getHeight() - box.top - box.h, width: w, height: h })
}

export function ssnFmt(digits: string): string {
  const d = digits.replace(/\D/g, '')
  return d.length === 9 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d
}

function dobParts(iso: string): { mm: string; dd: string; yyyy: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? { yyyy: m[1], mm: m[2], dd: m[3] } : { mm: '', dd: '', yyyy: '' }
}

function phoneFmt(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : raw
}

async function fillBackgroundAuth(bytes: Uint8Array, p: Profile, o: FillOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.getPage(0)

  put(page, font, p.ueid, 308, 180, 240)

  if (p.residedInPA === 'yes') check(page, font, 92, 226)
  if (p.residedInPA === 'no') check(page, font, 182, 226)
  // Position requires interaction with children: this site is for volunteers who do.
  check(page, font, 156, 273)

  const loc = { Parish: 219.5, School: 249, Both: 278.5 } as const
  if (p.locationType) dot(page, 296, loc[p.locationType])

  const pos = { Contractor: 219.5, Employee: 234, Priest: 249, Religious: 263.5, Teacher: 278, Volunteer: 293 } as const
  if (p.position) dot(page, 422, pos[p.position])

  put(page, font, p.lastName, 122, 341, 148)
  put(page, font, p.firstName, 275, 341, 68)
  put(page, font, p.middleName, 347, 341, 50)

  if (p.gender === 'Female') dot(page, 458, 337)
  if (p.gender === 'Male') dot(page, 458, 351.5)
  put(page, font, p.race, 442, 380, 120)

  const { mm, dd, yyyy } = dobParts(p.dob)
  put(page, font, mm, 143, 415)
  put(page, font, dd, 168, 415)
  put(page, font, yyyy, 202, 415)

  put(page, font, p.street, 152, 450, 266)
  put(page, font, p.apt, 430, 450, 130)
  put(page, font, p.city, 152, 488, 190)
  put(page, font, p.state, 347, 488, 75)
  put(page, font, p.zip, 428, 488, 130)

  put(page, font, phoneFmt(p.phone), 101, 522, 186)
  put(page, font, p.email, 384, 522, 180)
  put(page, font, p.siteName, 165, 546, 260)
  put(page, font, p.siteCity, 431, 546, 134)

  // The form only asks employees for an SSN.
  if (o.ssn && ssnOnAuthorization(p)) put(page, font, ssnFmt(o.ssn), 400, 415, 160)
  if (o.signed) {
    // One line runs across the bottom at 654 pt: signature on the left, date on the right.
    // Only ~22 pt of clear space between the consent paragraph and the line.
    await drawSignature(doc, page, o.signed.signature, { x: 80, top: 632, w: 260, h: 21 })
    put(page, font, o.signed.date, 420, 650, 140, 11)
  }

  return doc.save()
}

/**
 * The diocese's acknowledgment pages (revised 1/31/2024): Date and Signature share a row, then full-width
 * Location and Printed Name lines. Baselines are measured from the top of the page.
 */
async function fillAcknowledgment(
  bytes: Uint8Array,
  p: Profile,
  y: { signBaseline: number; locationBaseline: number; nameBaseline: number },
  o: FillOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.getPage(0)
  put(page, font, location(p), 76, y.locationBaseline, 285, 11)
  put(page, font, fullName(p), 76, y.nameBaseline, 292, 11)
  if (o.signed) {
    put(page, font, o.signed.date, 76, y.signBaseline, 168, 11)
    await drawSignature(doc, page, o.signed.signature, { x: 292, top: y.signBaseline - 34, w: 244, h: 34 })
  }
  return doc.save()
}

/** The diocese's fillable 2025 Social Media acknowledgment. */
async function fillSocialMedia(bytes: Uint8Array, p: Profile, o: FillOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  const text = (name: string, value: string) => {
    const field = form.getTextField(name)
    field.setText(clean(value))
    field.setFontSize(11)
  }
  text('Printed Name', fullName(p))
  text('Diocesan Location', location(p))
  if (o.signed) {
    text('Date', o.signed.date)
    // The "Signature" box is a digital-signature field (x 138, y 225, 401 x 29 from the bottom); draw the image in it.
    const page = doc.getPage(0)
    await drawSignature(doc, page, o.signed.signature, { x: 142, top: page.getHeight() - 225 - 28, w: 300, h: 26 })
  }
  form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica))
  if (o.signed || o.flatten) {
    form.removeField(form.getField('Signature')) // an empty digital-signature box has nothing to flatten
    form.flatten()
  }
  return doc.save()
}

async function fillNsor(bytes: Uint8Array, p: Profile, o: FillOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  const text = (name: string, value: string) => {
    const field = form.getTextField(name)
    field.setText(clean(value))
    field.setFontSize(10.5)
  }

  // The PDF's internal field names don't match the labels, so these are mapped by position on the page.
  text('Full Name', [p.lastName.trim(), [p.firstName.trim(), p.middleName.trim().slice(0, 1)].filter(Boolean).join(' ')].filter(Boolean).join(', '))
  // "Social Security Number XXXXXXXXX 1" is the SSN row: left blank on purpose.
  const { mm, dd, yyyy } = dobParts(p.dob)
  text('Social Security Number XXXXXXXXX 2', mm ? `${mm}/${dd}/${yyyy}` : '')
  text('Daytime Phone Number XXXXXXXXXX 1', phoneFmt(p.phone))
  text('Daytime Phone Number XXXXXXXXXX 2', [p.street.trim(), p.apt.trim()].filter(Boolean).join(', '))
  text('City State and Zip Code', [p.city.trim(), [p.state.trim(), p.zip.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', '))
  text('Email Address', p.email)
  form.getCheckBox('Volunteer of a childcare provider groupdaycare home or family child care home').check()

  if (o.ssn) text('Social Security Number XXXXXXXXX 1', ssnFmt(o.ssn)) // the SSN row
  if (o.signed) {
    text('Date', o.signed.date)
    // Signature box: x 98, y 35, 225 x 22 (from the bottom of the page).
    const page = doc.getPage(0)
    await drawSignature(doc, page, o.signed.signature, { x: 100, top: page.getHeight() - 35 - 24, w: 220, h: 24 })
  }

  form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica))
  // A signed copy is final, and a combined file needs it: flatten so the answers become part of the page.
  if (o.signed || o.flatten) form.flatten()
  return doc.save()
}

// --- The CPSL acknowledgment is re-typeset here because the diocese only publishes it as a scan ---

const LETTER: [number, number] = [612, 792]

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

async function typesetAcknowledgment(
  p: Profile,
  opts: { subtitle: string[]; paragraphs: string[] },
  o: FillOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage(LETTER)
  const regular = await doc.embedFont(StandardFonts.TimesRoman)
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const W = LETTER[0]
  const H = LETTER[1]
  const center = (t: string, y: number, f: PDFFont, size: number) =>
    page.drawText(t, { x: (W - f.widthOfTextAtSize(t, size)) / 2, y: H - y, size, font: f })

  let y = 72
  const header = [
    'DIOCESE OF ALLENTOWN',
    'OFFICE OF CATHOLIC HEALTH,',
    'HUMAN SERVICES, AND YOUTH PROTECTION',
    'OFFICE OF THE SECRETARY',
    'POST OFFICE BOX F',
    'ALLENTOWN, PENNSYLVANIA 18105-1538',
  ]
  header.forEach((t, i) => {
    center(t, y, i === 0 ? bold : regular, i === 0 ? 14 : 11)
    y += i === 0 ? 17 : 14
  })
  y += 18
  for (const t of opts.subtitle) {
    center(t, y, bold, 12.5)
    y += 17
  }
  y += 14

  const left = 72
  const width = W - 144
  for (const para of opts.paragraphs) {
    for (const line of wrap(regular, para, 12, width - 22)) {
      page.drawText(line, { x: left + 22, y: H - y, size: 12, font: regular })
      y += 16
    }
    y += 8
  }
  y += 36

  const line = (label: string, x: number, w: number, yy: number, value = '') => {
    page.drawLine({ start: { x, y: H - yy }, end: { x: x + w, y: H - yy }, thickness: 0.7 })
    page.drawText(label, { x, y: H - yy - 12, size: 9.5, font: regular })
    if (value) {
      let s = 11
      while (s > 6 && sans.widthOfTextAtSize(clean(value), s) > w - 4) s -= 0.5
      page.drawText(clean(value), { x: x + 2, y: H - yy + 3, size: s, font: sans, color: INK })
    }
  }
  const colB = 288
  const wideB = W - 72 - colB
  line('Date', left, 180, y, o.signed?.date)
  line('Signature of Clergy/Religious/Employee/Volunteer', colB, wideB, y)
  if (o.signed) await drawSignature(doc, page, o.signed.signature, { x: colB + 4, top: y - 34, w: wideB - 8, h: 32 })
  y += 52
  line('Diocesan Location', left, 180, y, location(p))
  line('Printed Name', colB, wideB, y, fullName(p))

  const note = o.signed ? `${SIGNED_NOTE} Signed on screen ${o.signed.date}.` : `${SIGNED_NOTE} Sign and date by hand. Use the diocese’s original if your location requires it.`
  page.drawText(clean(note), { x: left, y: 40, size: 8, font: sans, color: rgb(0.4, 0.4, 0.4) })
  return doc.save()
}

const SIGNED_NOTE = 'Re-typeset from the Diocese of Allentown form for legibility.'

function fillCpsl(p: Profile, o: FillOptions = {}) {
  return typesetAcknowledgment(p, {
    subtitle: ['DIOCESE OF ALLENTOWN', 'CHILD PROTECTIVE SERVICES LAW POLICY', 'ACKNOWLEDGMENT FORM'],
    paragraphs: [
      'I hereby acknowledge that I have received a copy of the Diocese of Allentown’s Child Protective Services Law Policy.',
      'I have reviewed the Child Protective Services Law Policy and understand its contents, and the process that I must complete if I have reasonable cause to suspect that a child has been subjected to child abuse or acts of child abuse.',
      'I further understand that the Diocese of Allentown has issued the Child Protective Services Law Policy for informational and guidance purposes only and that the Diocese does not intend for the policy to create a contract or any type of binding obligation on the Diocese. The Diocese of Allentown may periodically review the Child Protective Services Law Policy, and it reserves the right to amend or interpret the policy as it deems appropriate in its sole discretion. A copy of this acknowledgment form shall be placed in my personnel or volunteer file.',
    ],
  }, o)
}

const fileStem = (p: Profile) => {
  const who = [p.lastName, p.firstName].map((s) => s.trim().replace(/[^A-Za-z0-9]+/g, '-')).filter(Boolean).join('-')
  return who ? `-${who}` : ''
}

export async function fillForm(id: FormId, p: Profile, load: LoadBytes, o: FillOptions = {}): Promise<{ bytes: Uint8Array; filename: string }> {
  const suffix = fileStem(p)
  switch (id) {
    case 'bgauth':
      return { bytes: await fillBackgroundAuth(await load('forms/background-check-authorization.pdf'), p, o), filename: `background-check-authorization${suffix}.pdf` }
    case 'sexabuse':
      return {
        bytes: await fillAcknowledgment(await load('forms/sexual-abuse-acknowledgement.pdf'), p, { signBaseline: 467, locationBaseline: 523, nameBaseline: 567 }, o),
        filename: `sexual-abuse-acknowledgment${suffix}.pdf`,
      }
    case 'conduct':
      return {
        bytes: await fillAcknowledgment(await load('forms/code-of-conduct-acknowledgement.pdf'), p, { signBaseline: 453, locationBaseline: 509, nameBaseline: 553 }, o),
        filename: `code-of-conduct-acknowledgment${suffix}.pdf`,
      }
    case 'social':
      return { bytes: await fillSocialMedia(await load('forms/social-media-acknowledgement.pdf'), p, o), filename: `social-media-acknowledgment${suffix}.pdf` }
    case 'cpsl':
      return { bytes: await fillCpsl(p, o), filename: `cpsl-acknowledgment${suffix}.pdf` }
    case 'nsor':
      return { bytes: await fillNsor(await load('forms/nsor-application.pdf'), p, o), filename: `nsor-application${suffix}.pdf` }
  }
}

/** The forms in the order the diocese's checklist lists them. */
export const ALL_FORMS: FormId[] = ['sexabuse', 'conduct', 'social', 'cpsl', 'bgauth', 'nsor']

/** Fills the chosen forms (signing and dating them when `o.signed` is given), combined into one PDF in checklist order. */
export async function fillAll(p: Profile, load: LoadBytes, o: FillOptions = {}, forms: FormId[] = ALL_FORMS): Promise<{ bytes: Uint8Array; filename: string }> {
  const out = await PDFDocument.create()
  out.setTitle(`Volunteer clearance forms - ${fullName(p) || 'volunteer'}`)
  for (const id of ALL_FORMS.filter((f) => forms.includes(f))) {
    const filled = await PDFDocument.load((await fillForm(id, p, load, { ...o, flatten: true })).bytes)
    const pages = await out.copyPages(filled, filled.getPageIndices())
    pages.forEach((pg) => out.addPage(pg))
  }
  return { bytes: await out.save(), filename: `volunteer-forms${o.signed ? '-signed' : ''}${fileStem(p)}.pdf` }
}
