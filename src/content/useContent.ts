import { useSyncExternalStore } from 'react'

// A counter that goes up each time content is applied, so a page already on screen (the editor's preview) can redraw.

let version = 0
const listeners = new Set<() => void>()

export function contentApplied(): void {
  version++
  listeners.forEach((l) => l())
}

/** Redraws the calling component whenever new content is applied. Returns the current version. */
export function useContentVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
  )
}
