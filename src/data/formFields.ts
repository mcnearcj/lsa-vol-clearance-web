import type { FieldSource, CustomField } from '../content/schema'
import type { FormId, Profile, ProfileKey } from '../types'
import type { FormInfo } from './forms'

// Which "My info" fields each generated form uses, so the site can warn about blanks before downloading.

export const fieldLabels: Record<ProfileKey, string> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  dob: 'Date of birth',
  street: 'Street address',
  apt: 'Apartment or unit',
  city: 'City',
  state: 'State',
  zip: 'ZIP code',
  phone: 'Phone',
  email: 'Email',
  siteName: 'Parish or school',
  siteCity: 'Parish or school city',
  locationType: 'Location type',
  position: 'Your role',
  gender: 'Sex',
  race: 'Race',
  residedInPA: 'Lived in PA 1+ year',
  ueid: 'UEID',
}

/** Extra details the school added (from content). Updated in place when content loads. */
export const customFields: CustomField[] = []

const nameAndLocation: string[] = ['firstName', 'lastName', 'siteName', 'siteCity']
const contact: string[] = ['dob', 'street', 'city', 'state', 'zip', 'phone', 'email']

const builtInFormFields: Record<string, string[]> = {
  bgauth: [...nameAndLocation, ...contact, 'residedInPA', 'locationType', 'position'],
  sexabuse: nameAndLocation,
  conduct: nameAndLocation,
  social: nameAndLocation,
  cpsl: nameAndLocation,
  nsor: ['firstName', 'lastName', ...contact],
}

export const formFields: Record<FormId, string[]> = { ...builtInFormFields }

/** The built-in forms' fields, for forms that keep their built-in layout. */
export const builtInFieldsFor = (id: FormId): string[] | undefined => builtInFormFields[id]

/** Every source a school-added form reads from (PDF field mapping or placed boxes). */
export const sourcesOf = (f: FormInfo): FieldSource[] => [...Object.values(f.mapping ?? {}), ...(f.placements ?? []).map((p) => p.source)]

/** The "My info" details a set of sources reads from. */
export function fieldsUsedBy(sources: FieldSource[]): string[] {
  const keys = new Set<string>()
  for (const s of sources) {
    if (s.kind === 'field') keys.add(s.field)
    if (s.kind === 'name') ['firstName', 'lastName'].forEach((k) => keys.add(k))
  }
  return [...keys]
}

export const labelOfField = (key: string): string => fieldLabels[key as ProfileKey] ?? customFields.find((f) => f.id === key)?.label ?? key

/** The value of a detail, built-in or custom. */
export function valueOfField(p: Profile, key: string): string {
  if (key in fieldLabels) return String(p[key as ProfileKey] ?? '')
  return p.extra?.[key] ?? ''
}

/** The details the chosen forms use that are still blank, by their on-screen names. Sensitive extras are asked at the last step instead. */
export function missingFields(forms: FormId[], p: Profile): string[] {
  const keys = [...new Set(forms.flatMap((f) => formFields[f] ?? []))]
  return keys
    .filter((k) => !customFields.find((c) => c.id === k)?.sensitive)
    .filter((k) => !valueOfField(p, k).trim())
    .map(labelOfField)
}
