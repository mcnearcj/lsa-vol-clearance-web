import type { Content, FieldSource } from '../content/schema'
import { fieldLabels } from '../data/formFields'

/** The choices in a "what goes here" menu, as [value, label]. */
export function sourceOptions(content: Content, opts: { signature?: boolean } = {}): [string, string][] {
  const out: [string, string][] = [
    ['name', 'Full name'],
    ['date', 'Today’s date (when signed on screen)'],
    ...(opts.signature === false ? [] : [['signature', 'Signature (when signed on screen)'] as [string, string]]),
    ['ssn', 'Social Security Number (if typed)'],
    ['text', 'Fixed text…'],
  ]
  for (const [k, label] of Object.entries(fieldLabels)) out.push([`field:${k}`, `My info: ${label}`])
  for (const f of content.fields) out.push([`field:${f.id}`, `My info: ${f.label}`])
  return out
}

export function encodeSource(s: FieldSource | undefined): string {
  if (!s) return ''
  return s.kind === 'field' ? `field:${s.field}` : s.kind
}

export function decodeSource(v: string, prev?: FieldSource): FieldSource | undefined {
  if (!v) return undefined
  if (v.startsWith('field:')) return { kind: 'field', field: v.slice(6) }
  if (v === 'text') return { kind: 'text', text: prev?.kind === 'text' ? prev.text : '' }
  if (v === 'name' || v === 'date' || v === 'signature' || v === 'ssn') return { kind: v }
  return undefined
}
