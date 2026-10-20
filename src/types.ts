
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
  position: '',
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

export type GroupId = 'checks' | 'sign' | 'training' | 'driving'

export interface Requirement {
  id: string
  /** Number on the diocese's checklist, so coordinators and volunteers can refer to the same item. */
  number: number
  group: GroupId
  title: string
  summary: string
  /** How long it takes or how long results take, when the diocese's instructions say. */
  time?: string
  /** Years the clearance stays valid. Omit for one-time items. */
  validYears?: number
  /** Extra caution shown on the card. */
  note?: string
  optional?: boolean
  links: { label: string; href: string }[]
  steps: string[]
  /** A form for this item that's made under "Forms to sign". */
  form?: FormId
  /** Reference PDFs from the diocese (instructions, originals). */
  references?: { label: string; file: string }[]
  /** What the volunteer hands in for this item, for the submission checklist. */
  handIn: string
}

/** The Background Check Authorization asks only employees (any role other than volunteer) for an SSN. */
export const ssnOnAuthorization = (p: Profile) => p.position !== '' && p.position !== 'Volunteer'

/** The name to show for whose info is loaded, or '' if none has been entered. */
export const personName = (p: Profile) => [p.firstName, p.lastName].map((s) => s.trim()).filter(Boolean).join(' ')
