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
