
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
  /** Answers to extra details the school added (content.json), by field id. */
  extra: Record<string, string>
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
  extra: {},
}

export type Status = 'todo' | 'started' | 'done' | 'na'

export interface ItemProgress {
  status: Status
  completedOn?: string // YYYY-MM-DD
  notes?: string
}

export type Progress = Record<string, ItemProgress>

/** A form's id: one of the six built-in layouts or a form the school added. */
export type FormId = string

/** The built-in "My info" details (everything on Profile except the school's own extras). */
export type ProfileKey = Exclude<keyof Profile, 'extra'>

/** A checklist section's id. The built-in ones are checks, sign, training and driving. */
export type GroupId = string

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
  /** Extra line under this item on the printable checklist. */
  handInDetail?: string
  /** Reference PDFs from the diocese (instructions, originals). */
  references?: { label: string; file: string }[]
  /** What the volunteer hands in for this item, for the printable checklist. */
  handIn: string
}

/** The Background Check Authorization asks only employees (any role other than volunteer) for an SSN. */
export const ssnOnAuthorization = (p: Profile) => p.position !== '' && p.position !== 'Volunteer'

/** The name to show for whose info is loaded, or '' if none has been entered. */
export const personName = (p: Profile) => [p.firstName, p.lastName].map((s) => s.trim()).filter(Boolean).join(' ')
