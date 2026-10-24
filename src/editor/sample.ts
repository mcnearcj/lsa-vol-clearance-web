import type { Content } from '../content/schema'
import { applyContent } from '../content/apply'
import { fillForm } from '../pdf/fill'
import { emptyProfile, type Profile } from '../types'

/** Made-up details used to preview a form. */
export function sampleProfile(content: Content): Profile {
  const extra: Record<string, string> = {}
  for (const f of content.fields) extra[f.id] = f.type === 'date' ? '2000-01-02' : f.type === 'yesno' ? 'Yes' : f.type === 'choice' ? f.options?.[0] ?? 'Sample' : `Sample ${f.label}`
  return {
    ...emptyProfile,
    firstName: 'Jordan',
    middleName: 'Quinn',
    lastName: 'Testperson',
    dob: '1985-07-04',
    street: '123 Main Street',
    apt: 'Apt 4B',
    city: 'Bethlehem',
    state: 'PA',
    zip: '18015',
    phone: '6105550123',
    email: 'jordan@example.com',
    siteName: content.school.name,
    siteCity: 'Shillington',
    locationType: 'School',
    position: 'Volunteer',
    gender: 'Female',
    residedInPA: 'yes',
    extra,
  }
}

/** A scribble standing in for a signature. */
export async function sampleSignature(): Promise<Uint8Array> {
  const c = document.createElement('canvas')
  c.width = 360
  c.height = 90
  const ctx = c.getContext('2d')!
  ctx.strokeStyle = '#14215c'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(8, 60)
  for (let x = 8; x < 350; x += 4) ctx.lineTo(x, 50 + 22 * Math.sin(x / 18) * Math.exp(-x / 260))
  ctx.stroke()
  const blob = await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

/** The form filled in with sample details, using the editor's current (unsaved) settings and attached PDFs. */
export async function previewForm(content: Content, formId: string, load: (path: string) => Promise<Uint8Array>, signed: boolean): Promise<Uint8Array> {
  applyContent(content)
  const profile = sampleProfile(content)
  const sensitive: Record<string, string> = Object.fromEntries(content.fields.filter((f) => f.sensitive).map((f) => [f.id, 'Sample']))
  const { bytes } = await fillForm(formId, profile, load, {
    signed: signed ? { signature: await sampleSignature(), date: '10/24/2026' } : undefined,
    ssn: '123456789',
    sensitive,
  })
  return bytes
}
