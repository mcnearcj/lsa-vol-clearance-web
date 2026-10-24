// The school this copy of the site is set up for. These are the built-in settings; a school can override all of them
// with a data/content.json made by the editor (see src/content), without rebuilding.

export const site = {
  schoolName: 'La Salle Academy',
  /** Shown under the school name in the page header ('' for none). */
  tagline: 'Built on Faith. Bound for Success.',
  /** The school's own website: the logo and "Home" link go here ('' for none). */
  homeUrl: 'https://www.lsabear.com/',
  /** The school's crest, shown in the header and footer ('' for none). It's loaded from the school's own site. */
  logoUrl: 'https://resources.finalsite.net/images/f_auto,q_auto/v1690818344/adeducatorsorg/pgio0q6cj53cv5tq9diw/LaSalleAcademylogo2016.eps',
  /** The notice at the foot of every page (small markup: **bold**, [links](https://…), {school}). */
  footerNote:
    'This is a functional sample website and is not currently endorsed by {school} or the Diocese of Allentown. It’s a free, open-source project: [see the code on GitHub](https://github.com/mcnearcj/lsa-vol-clearance-web/tree/lsabear-custom).',
  /** Street address and phone for the footer ('' to leave out). */
  address: '440 Holland St., Shillington, PA 19607',
  phone: '610-777-7392',
  /** The diocese's checklist this site follows, and where its role-specific checklists live. */
  checklistName: 'School Volunteer Requirements Checklist',
  checklistRevised: '7/31/2025',
  requirementsUrl: 'https://www.allentowndiocese.org/safe-environment-requirements-for-employees-volunteers',
  /** Volunteers who aren't in a leadership role have a shorter list (rev. 3/17/2026). */
  limitedChecklistUrl: 'https://adtoday.nyc3.digitaloceanspaces.com/Limited-Volunteer2026.pdf',
  /** The diocese's page of current Safe Environment policies and forms: the source for this site's documents. */
  policiesUrl: 'https://www.allentowndiocese.org/safe-environment-policies',
  /** The checklist PDF the site bundles (relative to the site). */
  checklistFile: 'forms/requirements-checklist.pdf',
  /** When someone last compared the bundled documents with the diocese's pages, as YYYY-MM-DD ('' if not recorded). */
  checkedOn: '',
  /** Local Safe Environment Coordinator: hands out payment codes and collects finished paperwork. */
  lsec: { name: 'Jeanie Hauck', email: 'hauck@lsabear.com' },
  /** The diocese's contact for questions the coordinator can't answer. */
  diocese: {
    name: 'Janice Woolley',
    title: 'Background Check / Audit & Training Supervisor',
    address: 'Diocese of Allentown, PO Box F, Allentown, PA 18105-1538',
    phone: '610-871-5200 ext. 2258',
    email: 'jwoolley@allentowndiocese.org',
  },
}
