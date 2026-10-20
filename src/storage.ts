import { useCallback, useEffect, useState } from 'react'

// Everything is kept in this browser's localStorage. Nothing is sent to a server.
const PREFIX = 'lsa-vol-clearance:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function useStored<T extends object>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial))
  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // Storage can be blocked (private windows); the app still works for this visit.
    }
  }, [key, value])
  // Another tab of the site changed this value: show it here too, so an older tab never saves over a newer change.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || (e.key !== null && e.key !== PREFIX + key)) return
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

export function clearAllStored() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}
