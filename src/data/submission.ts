import { formatDate, standing } from '../dates'
import type { FormId, Progress, Requirement } from '../types'
import { FORMS, formInfo } from './forms'
import { requirements } from './requirements'
import { site } from './site'

// The volunteer's own submission checklist: what to hand in, to whom, and where each item stands.
// It's a separate download from the forms packet so it never gets sent to the diocese by mistake.

export interface SubmissionItem {
  label: string
  detail?: string
  status: string
  done: boolean
}

export interface SubmissionSection {
  title: string
  intro?: string
  items: SubmissionItem[]
}

function statusOf(req: Requirement, progress: Progress): { status: string; done: boolean } {
  const p = progress[req.id]
  const { standing: st, expiresOn } = standing(req, p)
  const on = p?.completedOn ? formatDate(p.completedOn) : ''
  switch (st) {
    case 'current':
      return { status: on ? `Done ${on}` : 'Done', done: true }
    case 'expiring':
      return { status: `Done ${on}; renew by ${formatDate(expiresOn!)}`, done: true }
    case 'expired':
      return { status: `Expired ${formatDate(expiresOn!)}: get a new one first`, done: false }
    case 'started':
      return { status: 'In progress', done: false }
    default:
      return { status: 'Not done yet', done: false }
  }
}

/** The forms in the download this checklist goes with, and the date if they were signed on screen (MM/DD/YYYY). */
export interface DownloadInfo {
  forms: FormId[]
  signedOn?: string
}

export function submissionChecklist(progress: Progress, download?: DownloadInfo): SubmissionSection[] {
  // The signable forms are tracked together: one "handed in" checkbox on the site covers them all.
  const handedIn = progress.forms?.status === 'done'
  const formItem = (id: FormId, detail?: string): SubmissionItem => {
    const label = formInfo(id).handIn
    if (download?.forms.includes(id))
      return download.signedOn
        ? { label, detail, status: `Signed on screen ${download.signedOn}`, done: true }
        : { label, detail, status: 'In this download: print it, then sign and date it', done: false }
    if (!handedIn && formInfo(id).kind === 'download') return { label, detail, status: 'Print it, fill it in by hand, then sign and date it', done: false }
    if (handedIn) return { label, detail, status: `Handed in${progress.forms?.completedOn ? ` ${formatDate(progress.forms.completedOn)}` : ''}`, done: true }
    return { label, detail, status: 'Not done yet', done: false }
  }
  const resultItem = (r: Requirement): SubmissionItem => ({ label: r.handIn, detail: r.handInDetail, ...statusOf(r, progress) })
  const skipped = (r: Requirement) => progress[r.id]?.status === 'na'
  const byNumber = (a: Requirement, b: Requirement) => a.number - b.number
  // Forms the school adds that are only printed (not filled in) are still handed in with the rest.
  const toLsec = FORMS.filter((f) => f.handTo === 'lsec')
  const toState = FORMS.filter((f) => f.handTo === 'state')

  const sections: SubmissionSection[] = [
    {
      title: 'Signed forms',
      intro: `Give these to ${site.lsec.name}.`,
      items: toLsec.map((f) => formItem(f.id, f.handInDetail)),
    },
  ]
  if (toState.length)
    sections.push({
      title: 'Send to the state',
      items: toState.map((f) => formItem(f.id, f.handInDetail)),
    })
  sections.push({
    title: 'Certificates and results',
    intro: `Give these to ${site.lsec.name} too.`,
    items: requirements
      .filter((r) => r.group !== 'driving' && !skipped(r))
      .sort(byNumber)
      .map(resultItem),
  })
  const driving = requirements.filter((r) => r.group === 'driving' && !skipped(r)).sort(byNumber)
  if (driving.length)
    sections.push({
      title: 'Only if you drive for the school',
      items: driving.map(resultItem),
    })
  return sections
}
