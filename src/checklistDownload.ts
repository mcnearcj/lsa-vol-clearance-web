import { site } from './data/site'
import { submissionChecklist } from './data/submission'
import { saveFile } from './save'
import { personName, type Profile, type Progress } from './types'

const today = () => {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

/** Downloads the volunteer's own submission checklist: a separate file from the forms, so it isn't handed in. */
export async function downloadChecklist(profile: Profile, progress: Progress, signedOn?: string) {
  const { makeChecklistPdf } = await import('./pdf/checklist')
  const name = personName(profile)
  const bytes = await makeChecklistPdf({
    name: [profile.firstName, profile.middleName, profile.lastName].map((s) => s.trim()).filter(Boolean).join(' '),
    schoolName: site.schoolName,
    lsec: site.lsec,
    date: today(),
    sections: submissionChecklist(progress, signedOn),
  })
  const who = name.replace(/[^A-Za-z0-9]+/g, '-')
  saveFile(`submission-checklist${who ? `-${who}` : ''}.pdf`, bytes, 'application/pdf')
}
