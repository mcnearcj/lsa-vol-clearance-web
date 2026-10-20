import type { ItemProgress, Requirement } from './types'

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addYears(iso: string, years: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const year = Number(m[1]) + years
  const month = Number(m[2])
  // Feb 29 has no match in a non-leap year; use Feb 28 rather than an invalid date.
  const lastDay = new Date(year, month, 0).getDate()
  const day = Math.min(Number(m[3]), lastDay)
  return `${year}-${m[2]}-${String(day).padStart(2, '0')}`
}

/** Today as MM/DD/YYYY, the way the forms want dates written. */
export const todayUS = () => {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function daysUntil(iso: string, from = todayISO()): number {
  const a = Date.parse(from + 'T00:00:00')
  const b = Date.parse(iso + 'T00:00:00')
  return Math.round((b - a) / 86_400_000)
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export type Standing = 'todo' | 'started' | 'current' | 'expiring' | 'expired' | 'na'

const EXPIRING_SOON_DAYS = 90

export function standing(req: Requirement, p: ItemProgress | undefined): { standing: Standing; expiresOn?: string } {
  const status = p?.status ?? 'todo'
  if (status === 'na') return { standing: 'na' }
  if (status === 'todo' || status === 'started') return { standing: status }
  if (req.validYears && p?.completedOn) {
    const expiresOn = addYears(p.completedOn, req.validYears)
    if (expiresOn) {
      const left = daysUntil(expiresOn)
      if (left < 0) return { standing: 'expired', expiresOn }
      if (left <= EXPIRING_SOON_DAYS) return { standing: 'expiring', expiresOn }
      return { standing: 'current', expiresOn }
    }
  }
  return { standing: 'current' }
}

export const standingLabel: Record<Standing, string> = {
  todo: 'Not started',
  started: 'In progress',
  current: 'Complete',
  expiring: 'Expiring soon',
  expired: 'Expired',
  na: 'Not applicable',
}
