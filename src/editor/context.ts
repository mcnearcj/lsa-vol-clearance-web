import { createContext, useContext } from 'react'
import type { Content } from '../content/schema'

/** What every editor section can read and change. */
export interface Ed {
  content: Content
  update: (fn: (draft: Content) => void) => void
  /** PDFs attached in this session, by the path they'll have in data/. */
  files: Map<string, Uint8Array>
  /** Keeps a PDF the person picked, and returns the path to refer to it by. */
  attach: (name: string, bytes: Uint8Array) => string
}

export const EdContext = createContext<Ed | null>(null)

export function useEd(): Ed {
  const ed = useContext(EdContext)
  if (!ed) throw new Error('Editor context missing')
  return ed
}
