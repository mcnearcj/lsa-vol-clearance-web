import { describe, expect, it } from 'vitest'
import { defaultContent } from '../content/apply'
import { countChanges, describeChanges, short } from './diff'
import { normalizeSiteUrl } from './util'

const clone = () => structuredClone(defaultContent)

describe('describeChanges', () => {
  it('is empty when nothing changed', () => {
    expect(describeChanges(clone(), clone())).toEqual([])
  })

  it('lists each changed field with its old and new value, grouped and collapsible by entry', () => {
    const b = clone()
    b.school.name = 'Test Academy'
    b.items[0].title = 'Renamed check'
    b.items[0].steps[1] = 'A different second step'
    b.items[0].steps.push('A brand new last step')
    b.forms[0].handIn = 'Signed thing'
    b.faq.push({ q: 'New question?', a: 'Yes' })
    const g = describeChanges(clone(), b)
    expect(g.map((x) => x.title)).toEqual(['School and checklist details', 'Checklist items', 'Forms', 'Questions and answers'])
    const item = g[1].entries[0]
    expect(item.title).toBe('Changed: Renamed check')
    expect(item.lines).toEqual(expect.arrayContaining([expect.stringContaining('Title: “PA State Police Criminal Record Check (PATCH)” → “Renamed check”'), expect.stringContaining('Step 2'), expect.stringContaining('Step ') ]))
    expect(item.lines.some((l) => l.includes('added'))).toBe(true)
    expect(countChanges(g)).toBe(4)
  })

  it('reports added and removed items, forms and boxes', () => {
    const b = clone()
    const removed = b.items.pop()!
    b.forms.push({ id: 'p1', kind: 'placed', label: 'Placed', handIn: 'x', handTo: 'lsec', file: 'data/forms/p1.pdf', placements: [{ page: 0, x: 1, y: 2, w: 30, h: 10, source: { kind: 'name' } }] })
    const g = describeChanges(clone(), b)
    const items = g.find((x) => x.title === 'Checklist items')!
    expect(items.entries[0].title).toBe(`Removed: ${removed.title}`)
    expect(g.find((x) => x.title === 'Forms')!.entries[0].title).toBe('Added: Placed')
  })

  it('shows boxes that were moved or changed', () => {
    const a = clone()
    a.forms.push({ id: 'p1', kind: 'placed', label: 'Placed', handIn: 'x', handTo: 'lsec', file: 'data/forms/p1.pdf', placements: [{ page: 0, x: 1, y: 2, w: 30, h: 10, source: { kind: 'name' } }] })
    const b = structuredClone(a)
    b.forms[b.forms.length - 1].placements![0].x = 50
    const entry = describeChanges(a, b).find((x) => x.title === 'Forms')!.entries[0]
    expect(entry.lines).toEqual(['Box changed: Full name (page 1): 1,2, 30×10 → 50,2, 30×10'])
  })

  it('shortens long values', () => {
    expect(short('x'.repeat(200)).length).toBeLessThan(80)
    expect(short('')).toBe('(blank)')
    expect(short(true)).toBe('yes')
  })
})

describe('normalizeSiteUrl', () => {
  it('adds https and a trailing slash, and drops the page name, query and hash', () => {
    expect(normalizeSiteUrl('clearances.example.org')).toBe('https://clearances.example.org/')
    expect(normalizeSiteUrl(' https://example.org/volunteers ')).toBe('https://example.org/volunteers/')
    expect(normalizeSiteUrl('https://example.org/volunteers/index.html?x=1#top')).toBe('https://example.org/volunteers/')
    expect(normalizeSiteUrl('localhost:8766')).toBe('http://localhost:8766/')
    expect(normalizeSiteUrl('')).toBeNull()
    expect(normalizeSiteUrl('http://')).toBeNull()
  })
})
