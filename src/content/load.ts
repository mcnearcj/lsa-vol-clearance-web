import { applyContent } from './apply'
import { validateContent } from './schema'

const TIMEOUT_MS = 4000

/** Where the school's settings file lives, next to the site. The editor's "Save" makes this file. */
export const CONTENT_PATH = 'data/content.json'

/**
 * Reads the school's settings (data/content.json, or settings embedded in the page) and applies them. Anything missing,
 * slow or invalid is ignored, so the site always opens on the built-in settings at worst.
 */
export async function loadContent(): Promise<void> {
  try {
    let raw: unknown
    const embedded = document.getElementById('content')
    if (embedded?.textContent?.trim()) raw = JSON.parse(embedded.textContent)
    else {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
      try {
        // A timestamp keeps a CDN or browser from handing back an old copy after the school uploads a new one.
        const res = await fetch(`${import.meta.env.BASE_URL}${CONTENT_PATH}?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal })
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return
        raw = await res.json()
      } finally {
        clearTimeout(timer)
      }
    }
    const result = validateContent(raw)
    if (result.ok) applyContent(result.content)
    else console.warn('data/content.json was ignored because of these problems:\n' + result.errors.join('\n'))
  } catch (e) {
    console.warn('data/content.json could not be read; using the built-in settings.', e)
  }
}
