import { site } from './data/site'
import { submissionChecklist, type DownloadInfo } from './data/submission'
import { personName, type Profile, type Progress } from './types'

const today = () => {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

/** The volunteer's own submission checklist: a separate file from the forms, so it isn't handed in. */
export async function makeChecklist(profile: Profile, progress: Progress, download?: DownloadInfo): Promise<{ bytes: Uint8Array; filename: string }> {
  const { makeChecklistPdf } = await import('./pdf/checklist')
  const bytes = await makeChecklistPdf({
    name: [profile.firstName, profile.middleName, profile.lastName].map((s) => s.trim()).filter(Boolean).join(' '),
    schoolName: site.schoolName,
    lsec: site.lsec,
    date: today(),
    sections: submissionChecklist(progress, download),
  })
  const who = personName(profile).replace(/[^A-Za-z0-9]+/g, '-')
  return { bytes, filename: `submission-checklist${who ? `-${who}` : ''}.pdf` }
}
