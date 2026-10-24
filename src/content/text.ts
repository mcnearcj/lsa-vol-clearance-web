import { site } from '../data/site'

/** Fills the placeholders the school's text can use ({lsec}, {school}…) with the current settings. */
export function fill(text: string): string {
  const values: Record<string, string> = {
    lsec: site.lsec.name,
    lsecEmail: site.lsec.email,
    school: site.schoolName,
    checklistName: site.checklistName,
    checklistFile: site.checklistFile,
    limitedUrl: site.limitedChecklistUrl,
    policiesUrl: site.policiesUrl,
    requirementsUrl: site.requirementsUrl,
  }
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
}

export type Inline = { type: 'text' | 'bold'; text: string } | { type: 'link'; text: string; href: string }

/** Where a link in school text may go: a web address, or a PDF that ships with the site (forms/ or data/). */
export function safeHref(href: string): string | null {
  if (/^https?:\/\/[^\s]+$/i.test(href)) return href
  if (/^(forms|data)\/[A-Za-z0-9._\-/ ]+$/i.test(href) && !href.includes('..')) return `${import.meta.env.BASE_URL}${href}`
  return null
}

/** Splits school text into paragraphs of plain, bold and link pieces. Nothing here is ever treated as HTML. */
export function parseRich(text: string): Inline[][] {
  return fill(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const out: Inline[] = []
      for (const part of p.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/)) {
        if (!part) continue
        const bold = /^\*\*([^*]+)\*\*$/.exec(part)
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
        if (bold) out.push({ type: 'bold', text: bold[1] })
        else if (link) {
          const href = safeHref(link[2])
          out.push(href ? { type: 'link', text: link[1], href } : { type: 'text', text: link[1] })
        } else out.push({ type: 'text', text: part })
      }
      return out
    })
}
