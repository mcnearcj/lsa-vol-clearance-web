import { afterEach, describe, expect, it } from 'vitest'
import { applyContent, defaultContent } from '../content/apply'
import { submissionChecklist } from './submission'

const clone = () => structuredClone(defaultContent)
afterEach(() => applyContent(clone()))

const titles = (s: ReturnType<typeof submissionChecklist>) => s.map((x) => x.title)
const labels = (s: ReturnType<typeof submissionChecklist>) => s.flatMap((x) => x.items).map((i) => i.label)

describe('submissionChecklist', () => {
  it('lists signed forms, the NSOR application, certificates and the driver form, with nothing about a person', () => {
    const s = submissionChecklist()
    expect(titles(s)).toEqual(['Signed forms', 'Send to the state', 'Certificates and results', 'Only if you drive for the school'])
    expect(s[0].items).toHaveLength(5)
    expect(s[2].items.map((i) => i.label)).toEqual([
      expect.stringContaining('PATCH'),
      'PA Child Abuse History Certificate',
      expect.stringContaining('FBI fingerprint'),
      expect.stringContaining('Protecting God'),
      'Mandated Reporter Training certificate',
      expect.stringContaining('NSOR verification letter'),
    ])
    for (const item of s.flatMap((x) => x.items)) expect(Object.keys(item).sort()).toEqual(['detail', 'label'])
  })

  it('always reflects the site’s current content: coordinator, added and removed items and forms', () => {
    const c = clone()
    c.lsec = { name: 'Pat Example', email: 'pat@example.org' }
    c.items = c.items.filter((r) => r.id !== 'mvr')
    c.items.push({ id: 'cpr', number: 20, group: 'training', title: 'CPR', summary: '', handIn: 'CPR card', links: [], steps: [] })
    c.forms.push({ id: 'slip', kind: 'download', label: 'Slip', handIn: 'Field trip slip', handTo: 'lsec', sourceUrl: 'https://example.org/slip.pdf' })
    applyContent(c)
    const s = submissionChecklist()
    expect(s[0].intro).toContain('Pat Example')
    expect(labels(s)).toEqual(expect.arrayContaining(['CPR card', 'Field trip slip']))
    expect(titles(s)).not.toContain('Only if you drive for the school')
  })
})
