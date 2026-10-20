// The school this copy of the site is set up for. Another parish or school can fork the site and change this file.

export const site = {
  schoolName: 'La Salle Academy',
  schoolCity: 'Shillington',
  locationType: 'School' as const,
  /** The diocese's page of current Safe Environment policies and forms: the source for this site's documents. */
  policiesUrl: 'https://www.allentowndiocese.org/safe-environment-policies',
  /** Local Safe Environment Coordinator: hands out payment codes and collects finished paperwork. */
  lsec: { name: 'Jeanie Hauck', email: 'hauck@lsabear.com' },
}
