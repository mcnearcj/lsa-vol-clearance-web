import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../types'
import { merge, same, type SyncData } from './merge'

const data = (profile: Partial<SyncData['profile']> = {}, progress: SyncData['progress'] = {}): SyncData => ({
  profile: { ...emptyProfile, firstName: 'Jordan', lastName: 'Example', ...profile },
  progress,
})

describe('merge', () => {
  const base = data({}, { patch: { status: 'todo' } })

  it('keeps changes made on each side to different things', () => {
    const phone = data({}, { patch: { status: 'done', completedOn: '2026-10-20' } }) // marked PATCH done on the phone
    const laptop = data({ street: '1 Main St' }, { patch: { status: 'todo' } }) // typed an address on the laptop
    expect(merge(base, laptop, phone)).toEqual(data({ street: '1 Main St' }, { patch: { status: 'done', completedOn: '2026-10-20' } }))
    expect(same(merge(base, phone, laptop), merge(base, laptop, phone))).toBe(true)
  })

  it('takes the other side’s change when this side changed nothing', () => {
    const remote = data({ phone: '610-555-0123' }, { patch: { status: 'started' } })
    expect(merge(base, base, remote)).toEqual(remote)
  })

  it('lets this device win when both changed the same detail', () => {
    const local = data({ city: 'Shillington' })
    const remote = data({ city: 'Reading' })
    expect(merge(base, local, remote).profile.city).toBe('Shillington')
  })

  it('carries over items added or removed on the other side', () => {
    const remote = data({}, { patch: { status: 'todo' }, fbi: { status: 'started' } })
    expect(merge(base, base, remote).progress.fbi).toEqual({ status: 'started' })
    const removed = data({}, {})
    expect(merge(base, base, removed).progress.patch).toBeUndefined()
  })

  it('treats blank and missing notes as the same', () => {
    expect(same({ status: 'todo', notes: '' }, { status: 'todo' })).toBe(true)
  })
})
