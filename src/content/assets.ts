// Where the site's files (the PDFs) are fetched from. Normally that's next to the page. In the editor's preview tab the
// page is a stand-in, so files come from the live site, and PDFs attached but not yet uploaded come from the editor.

let base: string = import.meta.env.BASE_URL
const overrides = new Map<string, string>()

/** Used only by the editor's preview: the live site's address ('' if unknown) and addresses for attached PDFs. */
export function setPreviewAssets(siteUrl: string, attached: Map<string, string>): void {
  base = siteUrl
  overrides.clear()
  attached.forEach((url, path) => overrides.set(path, url))
}

/** The address to fetch or link a site file (like forms/x.pdf or data/forms/y.pdf) from. */
export const assetUrl = (path: string): string => overrides.get(path) ?? `${base}${path}`
