import type { Requirement } from '../types'
import { FORMS } from './forms'
import { requirements } from './requirements'
import { site } from './site'

// The printable checklist: what to hand in, and to whom. It's built from the site's current content each time it's
// made, and it holds nothing about the person, so it's always up to date and needs no typing.

export interface SubmissionItem {
  label: string
  detail?: string
}

export interface SubmissionSection {
  title: string
  intro?: string
  items: SubmissionItem[]
}

export function submissionChecklist(): SubmissionSection[] {
  const byNumber = (a: Requirement, b: Requirement) => a.number - b.number
  const item = (label: string, detail?: string): SubmissionItem => ({ label, detail })
  // Forms the school adds that are only printed are still handed in with the rest.
  const toLsec = FORMS.filter((f) => f.handTo === 'lsec')
  const toState = FORMS.filter((f) => f.handTo === 'state')
  const results = requirements.filter((r) => r.group !== 'driving').sort(byNumber)
  const driving = requirements.filter((r) => r.group === 'driving').sort(byNumber)

  const sections: SubmissionSection[] = []
  if (toLsec.length) sections.push({ title: 'Signed forms', intro: `Give these to ${site.lsec.name}.`, items: toLsec.map((f) => item(f.handIn, f.handInDetail)) })
  if (toState.length) sections.push({ title: 'Send to the state', items: toState.map((f) => item(f.handIn, f.handInDetail)) })
  if (results.length) sections.push({ title: 'Certificates and results', intro: `Give these to ${site.lsec.name} too.`, items: results.map((r) => item(r.handIn, r.handInDetail)) })
  if (driving.length) sections.push({ title: 'Only if you drive for the school', items: driving.map((r) => item(r.handIn, r.handInDetail)) })
  return sections
}
