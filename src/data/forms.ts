import type { FormId } from '../types'
import { diocese } from './requirements'

// The six forms volunteers sign. They're filled in together under "Forms to sign" (FormsPanel) instead of being
// tracked one by one. Sources: the diocese's Safe Environment Policies page and the state's NSOR application.

export interface FormInfo {
  id: FormId
  /** Item number on the diocese's School Volunteer Requirements Checklist. */
  number: number
  label: string
  /** The policy to read before signing, when there is one. */
  policy?: string
  note?: string
  /** What the volunteer hands in, for the submission checklist. */
  handIn: string
}

/** In the diocese checklist's order, which is also the page order of the combined PDF. */
export const FORMS: FormInfo[] = [
  {
    id: 'sexabuse',
    number: 4,
    label: 'Sexual Abuse Policy Acknowledgment',
    policy: diocese('SexualAbusePolicy2022.pdf'),
    handIn: 'Signed Sexual Abuse Policy acknowledgment',
  },
  {
    id: 'conduct',
    number: 5,
    label: 'Code of Conduct Acknowledgment',
    policy: diocese('updated-Code-of-Conduct-PolicyCSAM6-5-25.pdf'),
    handIn: 'Signed Code of Conduct acknowledgment',
  },
  {
    id: 'social',
    number: 6,
    label: 'Social Media Acknowledgment (2025)',
    policy: diocese('socialmediaelectroniccommunicationspolicies.pdf'),
    handIn: 'Signed Social Media acknowledgment (2025)',
  },
  {
    id: 'cpsl',
    number: 9,
    label: 'CPSL Acknowledgment Form',
    policy: diocese('2025-CPSL.pdf'),
    handIn: 'Signed CPSL acknowledgment',
  },
  {
    id: 'bgauth',
    number: 10,
    label: 'Background Check Authorization Form',
    note: 'Lets the diocese run your background checks. Give it to your LSEC, or mail it to Janice Woolley, Audit & Training Supervisor, Diocese of Allentown, PO Box F, Allentown PA 18105.',
    handIn: 'Signed Background Check Authorization Form',
  },
  {
    id: 'nsor',
    number: 12,
    label: 'NSOR Application',
    note: 'The state’s form: you send this one to the state, not your LSEC.',
    handIn: 'Signed NSOR application (the state’s form, not the diocese’s)',
  },
]

export const FORM_ORDER: FormId[] = FORMS.map((f) => f.id)

export const formInfo = (id: FormId) => FORMS.find((f) => f.id === id)!
