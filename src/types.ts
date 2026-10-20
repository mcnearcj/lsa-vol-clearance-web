export interface Profile {
  lastName: string
  firstName: string
  middleName: string
  dob: string // YYYY-MM-DD
  street: string
  apt: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  siteName: string // e.g. "St. Joseph"
  siteCity: string // e.g. "Bethlehem"
  locationType: '' | 'Parish' | 'School' | 'Both'
  position: '' | 'Contractor' | 'Employee' | 'Priest' | 'Religious' | 'Teacher' | 'Volunteer'
  gender: '' | 'Female' | 'Male'
  race: string
  residedInPA: '' | 'yes' | 'no'
  ueid: string
}

export const emptyProfile: Profile = {
  lastName: '',
  firstName: '',
  middleName: '',
  dob: '',
  street: '',
  apt: '',
  city: '',
  state: 'PA',
  zip: '',
  phone: '',
  email: '',
  siteName: '',
  siteCity: '',
  locationType: '',
  position: 'Volunteer',
  gender: '',
  race: '',
  residedInPA: '',
  ueid: '',
}

export type Status = 'todo' | 'started' | 'done' | 'na'

export interface ItemProgress {
  status: Status
  completedOn?: string // YYYY-MM-DD
  notes?: string
}

export type Progress = Record<string, ItemProgress>

export type FormId = 'bgauth' | 'sexabuse' | 'conduct' | 'social' | 'cpsl' | 'nsor'

export interface Requirement {
  id: string
  number: number
  title: string
  summary: string
  /** Years the clearance stays valid. Omit for one-time items. */
  validYears?: number
  /** Extra caution shown on the card. */
  note?: string
  optional?: boolean
  links: { label: string; href: string }[]
  steps: string[]
  /** Form the site can pre-fill. */
  form?: { id: FormId; label: string }
  /** Reference PDFs from the diocese (instructions, originals). */
  references?: { label: string; file: string }[]
}
