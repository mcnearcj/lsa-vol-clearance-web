import type { FormId, Profile } from '../types'

// Which "My info" fields each generated form uses, so the site can warn about blanks before downloading.

export const fieldLabels: Partial<Record<keyof Profile, string>> = {
  firstName: 'First name',
  lastName: 'Last name',
  dob: 'Date of birth',
  street: 'Street address',
  city: 'City',
  state: 'State',
  zip: 'ZIP code',
  phone: 'Phone',
  email: 'Email',
  siteName: 'Parish or school',
  siteCity: 'Parish or school city',
  residedInPA: 'Lived in PA 1+ year',
  locationType: 'Location type',
  position: 'Your role',
}

const nameAndLocation: (keyof Profile)[] = ['firstName', 'lastName', 'siteName', 'siteCity']
const contact: (keyof Profile)[] = ['dob', 'street', 'city', 'state', 'zip', 'phone', 'email']

export const formFields: Record<FormId, (keyof Profile)[]> = {
  bgauth: [...nameAndLocation, ...contact, 'residedInPA', 'locationType', 'position'],
  sexabuse: nameAndLocation,
  conduct: nameAndLocation,
  social: nameAndLocation,
  cpsl: nameAndLocation,
  nsor: ['firstName', 'lastName', ...contact],
}

/** The details the chosen forms use that are still blank, by their on-screen names. */
export function missingFields(forms: FormId[], p: Profile): string[] {
  const keys = [...new Set(forms.flatMap((f) => formFields[f]))]
  return keys.filter((k) => !String(p[k]).trim()).map((k) => fieldLabels[k] ?? k)
}
