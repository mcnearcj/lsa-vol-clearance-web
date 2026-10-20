// Catholic schools in the Diocese of Allentown, for the "Parish or school" suggestions on My info.
// Source: the diocese's school list (DOACatholicSchoolsUpdate-8-16-2026.tsv, linked from
// https://www.adschools.org/find-a-school). Update it when the diocese publishes a new list.

export interface School {
  name: string
  city: string
}

export const schools: School[] = [
  { name: 'Allentown Central Catholic High School', city: 'Allentown' },
  { name: 'Assumption BVM School', city: 'Pottsville' },
  { name: 'Berks Catholic High School', city: 'Reading' },
  { name: 'Bethlehem Catholic High School', city: 'Bethlehem' },
  { name: 'Good Shepherd Catholic School', city: 'Northampton' },
  { name: 'Holy Family School', city: 'Nazareth' },
  { name: 'Holy Guardian Angels', city: 'Reading' },
  { name: 'Holy Infancy School', city: 'Bethlehem' },
  { name: 'Immaculate Conception School', city: 'Pen Argyl' },
  { name: 'John Paul II Center for Special Learning', city: 'Shillington' },
  { name: 'La Salle Academy', city: 'Shillington' },
  { name: 'Marian Catholic High School', city: 'Tamaqua' },
  { name: 'Mercy School for Special Learning', city: 'Allentown' },
  { name: 'Nativity BVM High School', city: 'Pottsville' },
  { name: 'Notre Dame High School', city: 'Easton' },
  { name: 'Notre Dame School of Bethlehem', city: 'Bethlehem' },
  { name: 'Our Lady of Perpetual Help School', city: 'Bethlehem' },
  { name: 'Sacred Heart School', city: 'West Reading' },
  { name: 'St. Ann School', city: 'Emmaus' },
  { name: 'St. Anne School', city: 'Bethlehem' },
  { name: 'St. Catharine of Siena School', city: 'Reading' },
  { name: 'St. Elizabeth Regional School', city: 'Whitehall' },
  { name: 'St. Francis Classical Catholic Academy (Independent)', city: 'Bally' },
  { name: 'St. Ignatius Regional School', city: 'West Lawn' },
  { name: 'St. Jane Frances de Chantal School', city: 'Easton' },
  { name: 'St. Jerome Regional School', city: 'Tamaqua' },
  { name: 'St. John Neumann Regional School (Grades 3 - 8)', city: 'Palmerton' },
  { name: 'St. John Neumann Regional School (PreK - 2)', city: 'Slatington' },
  { name: 'St. John Vianney Regional School', city: 'Allentown' },
  { name: 'St. Joseph Center for Special Learning', city: 'Schuylkill Haven' },
  { name: 'St. Joseph the Worker School', city: 'Orefield' },
  { name: 'St. Michael the Archangel School (ES)', city: 'Coopersburg' },
  { name: 'St. Michael the Archangel School (MS)', city: 'Bethlehem' },
  { name: 'St. Peter School', city: 'Reading' },
  { name: 'St. Thomas More School', city: 'Allentown' },
]

/** Lowercase words, with "Saint" and "St." treated alike. */
const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/\./g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w === 'saint' ? 'st' : w))

export const findSchool = (name: string) => schools.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())

/** Schools whose name has a word starting with each typed word: "berks" finds Berks Catholic High School. */
export function matchSchools(typed: string): School[] {
  const want = words(typed)
  if (!want.length || findSchool(typed)) return []
  return schools.filter((s) => {
    const have = words(s.name)
    return want.every((w) => have.some((h) => h.startsWith(w)))
  })
}
