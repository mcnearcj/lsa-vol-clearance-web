import type { FaqEntry } from '../content/schema'

// The Help page questions. Answers use the small markup in src/content/text.ts: blank line = new paragraph,
// **bold**, [text](https://link), and placeholders such as {lsec} that the site fills in.

export const faq: FaqEntry[] = [
  {
    q: 'Do I need to do everything on this list?',
    a: `It depends on your role. The diocese’s [{checklistName}]({checklistFile}) says all school volunteers need everything here, except the driver form, which is only for people who drive for the school. The FBI fingerprint check is for volunteers 18 and older.

The diocese also has a [Limited Volunteer checklist]({limitedUrl}) for volunteers whose duties are strictly limited and who don’t serve in a leadership role. They need only the four policy acknowledgments (Sexual Abuse, Code of Conduct, Social Media, CPSL), Protecting God’s Children, and the driver form if they drive: no background checks or Mandated Reporter training.

**If you’re not sure which applies to you, ask {lsec} ({lsecEmail}) before you start.** Your school decides who counts as a limited volunteer.`,
  },
  {
    q: 'How often do I renew?',
    a: 'Background checks and the Mandated Reporter training last 5 years. Protecting God’s Children is a one-time training. Your coordinator can tell you when yours are due.',
  },
  {
    q: 'Which forms need my Social Security Number?',
    a: `Of the forms this site fills in, only the **NSOR application** (the state requires it). The **Background Check Authorization** asks for it from employees only, so volunteers leave it blank. The acknowledgment forms don’t ask for it.

Two of the state’s online systems also ask for it when you apply there: the **Child Abuse History** clearance (include it, or your results take longer) and **PATCH** (optional, but recommended).`,
  },
  {
    q: 'How is my Social Security Number handled here?',
    a: 'It’s only asked for under “Forms to sign”, and only to fill in the files you make there. It’s never saved on your device or sent anywhere. Leave it blank there to write it on the printed form by hand instead.',
  },
  {
    q: 'I’m using a shared computer. Is that OK?',
    a: `Yes. Choose “erase it when I leave” (the default), or use a private window (Incognito in Chrome, InPrivate in Edge, or Private Browsing in Safari and Firefox). Check the name at the top of each page, and when you’re done, choose “Not you?” or “Erase my data” below. If you see someone else’s name, choose “Not you?” to start fresh.`,
  },
]
