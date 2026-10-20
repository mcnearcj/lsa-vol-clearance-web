import { formatDate, standing } from '../dates'
import type { Progress, Requirement } from '../types'
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

const byId = (id: string) => requirements.find((r) => r.id === id)!

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

/** `signedOn` is set when the forms were just signed on screen (MM/DD/YYYY). */
export function submissionChecklist(progress: Progress, signedOn?: string): SubmissionSection[] {
  const formItem = (id: string, detail?: string): SubmissionItem => {
    const req = byId(id)
    return signedOn ? { label: req.handIn, detail, status: `Signed on screen ${signedOn}`, done: true } : { label: req.handIn, detail, ...statusOf(req, progress) }
  }
  const resultItem = (id: string, detail?: string): SubmissionItem => ({ label: byId(id).handIn, detail, ...statusOf(byId(id), progress) })

  const sections: SubmissionSection[] = [
    {
      title: 'Signed forms',
      intro: `Give these to ${site.lsec.name}.`,
      items: ['sexabuse', 'conduct', 'social', 'cpsl', 'bgauth'].map((id) => formItem(id)),
    },
    {
      title: 'Send to the state',
      items: [
        {
          ...formItem('nsor', 'Mail it, scan and email it to RA-PWNSOR@pa.gov, or drop it off. It takes about 14 days.'),
          label: 'Signed NSOR application (the state’s form, not the diocese’s)',
        },
      ],
    },
    {
      title: 'Certificates and results',
      intro: `Give these to ${site.lsec.name} too.`,
      items: [
        resultItem('patch'),
        resultItem('childabuse'),
        resultItem('fbi'),
        resultItem('pgc'),
        resultItem('mandated'),
        resultItem('nsor', 'The state mails or emails this after you send the NSOR application.'),
      ],
    },
  ]
  if (progress.mvr?.status !== 'na') {
    sections.push({
      title: 'Only if you drive for the school',
      items: [resultItem('mvr', 'Ask your LSEC for the form. Mail the original to the Diocese of Allentown Safe Environment Office, PO Box F, Allentown PA 18105-1538.')],
    })
  }
  return sections
}
