import { useCallback, useEffect, useState } from 'react'

// Everything stays in this browser; nothing is sent to a server. The volunteer chooses whether it's kept on this
// computer (localStorage) or erased when the tab closes (sessionStorage, the default).
const PREFIX = 'lsa-vol-clearance:'
const MODE_KEY = PREFIX + 'mode'

export type StorageMode = 'keep' | 'erase'

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** The choice made on the first screen, or null if this visit hasn't made one yet. */
export function getStorageMode(): StorageMode | null {
  if (safe(() => localStorage.getItem(MODE_KEY), null) === 'keep') return 'keep'
  if (safe(() => sessionStorage.getItem(MODE_KEY), null) === 'erase') return 'erase'
  return null
}

const store = (): Storage => (getStorageMode() === 'keep' ? localStorage : sessionStorage)

const dataKeys = (s: Storage) => Object.keys(s).filter((k) => k.startsWith(PREFIX) && k !== MODE_KEY)

/** Records the choice and moves anything already saved to the matching place. "keep" is the only choice remembered across visits. */
export function setStorageMode(mode: StorageMode) {
  safe(() => {
    const [from, to] = mode === 'keep' ? [sessionStorage, localStorage] : [localStorage, sessionStorage]
    dataKeys(from).forEach((k) => {
      to.setItem(k, from.getItem(k)!)
      from.removeItem(k)
    })
    if (mode === 'keep') {
      localStorage.setItem(MODE_KEY, 'keep')
      sessionStorage.removeItem(MODE_KEY)
    } else {
      localStorage.removeItem(MODE_KEY)
      sessionStorage.setItem(MODE_KEY, 'erase')
    }
  }, undefined)
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = store().getItem(PREFIX + key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function useStored<T extends object>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial))
  useEffect(() => {
    try {
      store().setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // Storage can be blocked (private windows); the app still works for this visit.
    }
  }, [key, value])
  // Another tab of the site changed this value: show it here too, so an older tab never saves over a newer change.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== store() || (e.key !== null && e.key !== PREFIX + key)) return
      setValue(read(key, initial))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // `initial` is only a fallback for an empty slot; a new object each render shouldn't re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const set = useCallback((next: T) => setValue(next), [])
  return [value, set]
}

/** Removes everyone's info and progress from this browser. The keep/erase choice itself stays. */
export function clearAllStored() {
  safe(() => {
    dataKeys(localStorage).forEach((k) => localStorage.removeItem(k))
    dataKeys(sessionStorage).forEach((k) => sessionStorage.removeItem(k))
  }, undefined)
}
