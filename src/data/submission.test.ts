import { describe, expect, it } from 'vitest'
import { submissionChecklist } from './submission'

const titles = (s: ReturnType<typeof submissionChecklist>) => s.map((x) => x.title)
const find = (s: ReturnType<typeof submissionChecklist>, text: string) => s.flatMap((x) => x.items).find((i) => i.label.includes(text))!

describe('submissionChecklist', () => {
  it('lists signed forms, the NSOR application, and the certificates to hand in', () => {
    const s = submissionChecklist({})
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
  })

  it('marks the forms in a signed download as signed', () => {
    const s = submissionChecklist({}, { forms: ['sexabuse', 'conduct', 'social', 'cpsl', 'bgauth', 'nsor'], signedOn: '10/20/2026' })
    expect(s[0].items.every((i) => i.done && i.status === 'Signed on screen 10/20/2026')).toBe(true)
    expect(find(s, 'PATCH').done).toBe(false)
  })

  it('says to sign by hand for an unsigned download, and uses the handed-in checkbox for forms not in it', () => {
    const s = submissionChecklist({ forms: { status: 'done', completedOn: '2026-09-01' } }, { forms: ['conduct'] })
    expect(find(s, 'Code of Conduct')).toMatchObject({ done: false, status: expect.stringContaining('print it, then sign') })
    expect(find(s, 'Sexual Abuse')).toMatchObject({ done: true, status: expect.stringContaining('Handed in') })
  })

  it('shows each certificate’s status from the checklist', () => {
    const s = submissionChecklist({ patch: { status: 'done', completedOn: '2026-10-01' }, fbi: { status: 'started' } })
    expect(find(s, 'PATCH')).toMatchObject({ done: true, status: expect.stringContaining('Done') })
    expect(find(s, 'FBI')).toMatchObject({ done: false, status: 'In progress' })
    expect(find(s, 'Protecting God')).toMatchObject({ done: false, status: 'Not done yet' })
  })

  it('leaves out the driver form for people who don’t drive', () => {
    expect(titles(submissionChecklist({ mvr: { status: 'na' } }))).not.toContain('Only if you drive for the school')
  })
})
