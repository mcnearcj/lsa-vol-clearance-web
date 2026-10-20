import { describe, expect, it } from 'vitest'
import { addYears, standing } from './dates'
import type { Requirement } from './types'

const req = (validYears?: number) => ({ id: 'x', validYears }) as Requirement

const isoDaysFromToday = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('addYears', () => {
  it('adds whole years', () => {
    expect(addYears('2021-11-20', 5)).toBe('2026-11-20')
  })
  it('turns Feb 29 into Feb 28 in a non-leap year', () => {
    expect(addYears('2024-02-29', 5)).toBe('2029-02-28')
    expect(addYears('2024-02-29', 4)).toBe('2028-02-29')
  })
  it('rejects malformed dates', () => {
    expect(addYears('11/20/2021', 5)).toBeNull()
  })
})

describe('standing', () => {
  it('reports not started, in progress and not applicable as-is', () => {
    expect(standing(req(5), undefined).standing).toBe('todo')
    expect(standing(req(5), { status: 'started' }).standing).toBe('started')
    expect(standing(req(5), { status: 'na' }).standing).toBe('na')
  })
  it('marks a 5-year clearance current, expiring within 90 days, or expired', () => {
    const fiveYearsAgo = (days: number) => {
      const d = isoDaysFromToday(days)
      return `${Number(d.slice(0, 4)) - 5}${d.slice(4)}`
    }
    expect(standing(req(5), { status: 'done', completedOn: fiveYearsAgo(200) }).standing).toBe('current')
    expect(standing(req(5), { status: 'done', completedOn: fiveYearsAgo(30) }).standing).toBe('expiring')
    expect(standing(req(5), { status: 'done', completedOn: fiveYearsAgo(-1) }).standing).toBe('expired')
  })
  it('never expires one-time items', () => {
    expect(standing(req(undefined), { status: 'done', completedOn: '2000-01-01' }).standing).toBe('current')
  })
})
