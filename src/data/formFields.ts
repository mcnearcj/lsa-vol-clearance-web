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
  residedInPA: 'Lived in PA more than a year',
  locationType: 'Location type',
  position: 'Diocesan position',
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

export function missingFields(form: FormId, p: Profile): string[] {
  return formFields[form].filter((k) => !String(p[k]).trim()).map((k) => fieldLabels[k] ?? k)
}

/** Every field any form uses, for the completeness count on "My info". */
export const allFormFields: (keyof Profile)[] = [...new Set(Object.values(formFields).flat())]
