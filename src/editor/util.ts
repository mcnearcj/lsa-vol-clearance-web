/** Moves item `i` of a list up or down. */
export function moved<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'item'

/** An id built from `base` that isn't in `taken`. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const b = slug(base)
  if (!used.has(b)) return b
  let n = 2
  while (used.has(`${b}-${n}`)) n++
  return `${b}-${n}`
}

export function readFile(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((b) => new Uint8Array(b))
}

/** A typed web address made safe to build paths from: https by default, one trailing slash, no page name or extras. */
export function normalizeSiteUrl(raw: string): string | null {
  let s = raw.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `${/^(localhost|127\.|\[::1\])/i.test(s) ? 'http' : 'https'}://${s}`
  try {
    const u = new URL(s)
    u.hash = ''
    u.search = ''
    u.pathname = u.pathname.replace(/\/[^/]*\.[a-z0-9]+$/i, '/').replace(/\/?$/, '/')
    return u.toString()
  } catch {
    return null
  }
}

