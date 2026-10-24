import { site } from './data/site'
import { submissionChecklist } from './data/submission'
import { todayUS } from './dates'

/** The blank printable checklist, made from the site's content as it is right now. */
export async function makeChecklist(): Promise<{ bytes: Uint8Array; filename: string }> {
  const { makeChecklistPdf } = await import('./pdf/checklist')
  const bytes = await makeChecklistPdf({
    schoolName: site.schoolName,
    lsec: site.lsec,
    date: todayUS(),
    basedOn: `${site.checklistName}, revised ${site.checklistRevised}`,
    sections: submissionChecklist(),
  })
  return { bytes, filename: 'volunteer-clearance-checklist.pdf' }
}
