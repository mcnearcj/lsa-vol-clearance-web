import { createContext, useContext, useEffect, useState } from 'react'
import type { Content } from '../content/schema'

/** What every editor section can read and change. */
export interface Ed {
  content: Content
  update: (fn: (draft: Content) => void) => void
  /** PDFs attached in this session, by the path they'll have in data/. */
  files: Map<string, Uint8Array>
  /** Keeps a PDF the person picked, and returns the path to refer to it by. */
  attach: (name: string, bytes: Uint8Array) => string
  /** The live website's address (with a trailing slash), or '' when settings came from a file. */
  siteUrl: string
  /** A PDF the person attached, or one fetched from the live site. Undefined if it can't be had. */
  fetchRemote: (path: string) => Promise<Uint8Array | undefined>
}

export const EdContext = createContext<Ed | null>(null)

export function useEd(): Ed {
  const ed = useContext(EdContext)
  if (!ed) throw new Error('Editor context missing')
  return ed
}

/** The bytes of a PDF the site uses: attached in this session, else read from the live site. */
export function useFileBytes(path: string | undefined): { bytes: Uint8Array | undefined; loading: boolean } {
  const { files, fetchRemote, siteUrl } = useEd()
  const [remote, setRemote] = useState<{ path: string; bytes: Uint8Array | undefined } | null>(null)
  const attached = path ? files.get(path) : undefined
  useEffect(() => {
    if (!path || attached) return
    let live = true
    void fetchRemote(path).then((bytes) => live && setRemote({ path, bytes }))
    return () => {
      live = false
    }
    // fetchRemote changes identity with the site address; the path and address are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, attached, siteUrl])
  if (attached) return { bytes: attached, loading: false }
  if (!path) return { bytes: undefined, loading: false }
  if (remote?.path === path) return { bytes: remote.bytes, loading: false }
  return { bytes: undefined, loading: Boolean(siteUrl) }
}

/** Gets a PDF's bytes for a preview: attached in this session, else from the live site. */
export function useLoadFile(): (path: string) => Promise<Uint8Array> {
  const { files, fetchRemote } = useEd()
  return async (path) => {
    const bytes = files.get(path) ?? (await fetchRemote(path))
    if (!bytes) throw new Error('The editor couldn’t get that PDF. Attach it again so there is something to preview.')
    return bytes
  }
}
