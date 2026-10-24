import type { FormId } from '../types'
import type { FieldSource, Placement } from '../content/schema'
import { diocese } from './requirements'

// The six forms volunteers sign. They're filled in together under "Forms to sign" (FormsPanel) instead of being
// tracked one by one. Sources: the diocese's Safe Environment Policies page and the state's NSOR application.

export type FormKind = 'built-in' | 'download' | 'fillable' | 'placed'

export interface FormInfo {
  id: FormId
  /** How the site handles the form: one of the six tuned layouts, a PDF to print, a PDF with fields, or a PDF with placed boxes. */
  kind: FormKind
  /** Item number on the diocese's School Volunteer Requirements Checklist (forms the school adds can leave it out). */
  number?: number
  label: string
  /** The blank PDF, relative to the site. Built-in forms have a default; a school can point at a newer copy. */
  file?: string
  /** The official source (the diocese's or state's own file or page), always shown as a link. */
  sourceUrl?: string
  /** When a copy of the source was last attached, as YYYY-MM-DD. */
  copiedOn?: string
  /** The policy to read before signing, when there is one. */
  policy?: string
  note?: string
  /** What the volunteer hands in, for the printable checklist. */
  handIn: string
  handInDetail?: string
  /** Who gets the signed form: the school's coordinator or the state. */
  handTo: 'lsec' | 'state'
  /** `fillable` forms: what each PDF field gets. */
  mapping?: Record<string, FieldSource>
  /** `placed` forms: where each answer is drawn. */
  placements?: Placement[]
}

/** In the diocese checklist's order, which is also the page order of the combined PDF. */
export const FORMS: FormInfo[] = [
  {
    id: 'sexabuse',
    kind: 'built-in',
    file: 'forms/sexual-abuse-acknowledgement.pdf',
    handTo: 'lsec',
    number: 4,
    label: 'Sexual Abuse Policy Acknowledgment',
    policy: diocese('SexualAbusePolicy2022.pdf'),
    handIn: 'Signed Sexual Abuse Policy acknowledgment',
  },
  {
    id: 'conduct',
    kind: 'built-in',
    file: 'forms/code-of-conduct-acknowledgement.pdf',
    handTo: 'lsec',
    number: 5,
    label: 'Code of Conduct Acknowledgment',
    policy: diocese('updated-Code-of-Conduct-PolicyCSAM6-5-25.pdf'),
    handIn: 'Signed Code of Conduct acknowledgment',
  },
  {
    id: 'social',
    kind: 'built-in',
    file: 'forms/social-media-acknowledgement.pdf',
    handTo: 'lsec',
    number: 6,
    label: 'Social Media Acknowledgment (2025)',
    policy: diocese('socialmediaelectroniccommunicationspolicies.pdf'),
    handIn: 'Signed Social Media acknowledgment (2025)',
  },
  {
    id: 'cpsl',
    kind: 'built-in',
    handTo: 'lsec',
    number: 9,
    label: 'CPSL Acknowledgment Form',
    policy: diocese('2025-CPSL.pdf'),
    handIn: 'Signed CPSL acknowledgment',
  },
  {
    id: 'bgauth',
    kind: 'built-in',
    file: 'forms/background-check-authorization.pdf',
    handTo: 'lsec',
    number: 10,
    label: 'Background Check Authorization Form',
    note: 'Lets the diocese run your background checks. Give it to your LSEC, or mail it to Janice Woolley, Audit & Training Supervisor, Diocese of Allentown, PO Box F, Allentown PA 18105.',
    handIn: 'Signed Background Check Authorization Form',
  },
  {
    id: 'nsor',
    kind: 'built-in',
    file: 'forms/nsor-application.pdf',
    handTo: 'state',
    number: 12,
    label: 'NSOR Application',
    note: 'The state’s form: you send this one to the state, not your LSEC.',
    handIn: 'Signed NSOR application (the state’s form, not the diocese’s)',
    handInDetail: 'Mail it, scan and email it to RA-PWNSOR@pa.gov, or drop it off. It takes about 14 days.',
  },
]

/** In the same order as FORMS. Kept as one array that content updates in place. */
export const FORM_ORDER: FormId[] = FORMS.map((f) => f.id)

export const formInfo = (id: FormId) => FORMS.find((f) => f.id === id)!
