import type { ItemProgress, Profile, Progress } from '../types'

// Combines changes made on two devices (or two tabs) since they last agreed.
// `base` is the last version both sides had; anything one side changed and the other didn't is kept.
// If both changed the same detail differently, the copy on this device wins: it's the one the person is looking at.

export interface SyncData {
  profile: Profile
  progress: Progress
}

/** JSON with sorted keys and empty values dropped, so two copies of the same data compare equal. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== '')
    return `{${entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export const same = (a: unknown, b: unknown) => stable(a) === stable(b)

function pick<T>(base: T, local: T, remote: T): T {
  if (same(local, base)) return remote // only the other side changed it (or nobody did)
  return local // this side changed it; it wins even if the other side changed it too
}

export function merge(base: SyncData, local: SyncData, remote: SyncData): SyncData {
  const profile = { ...local.profile }
  for (const key of Object.keys({ ...base.profile, ...local.profile, ...remote.profile }) as (keyof Profile)[]) {
    ;(profile as Record<string, unknown>)[key] = pick(base.profile[key], local.profile[key], remote.profile[key])
  }

  const progress: Progress = {}
  for (const id of new Set([...Object.keys(base.progress), ...Object.keys(local.progress), ...Object.keys(remote.progress)])) {
    const item = pick<ItemProgress | undefined>(base.progress[id], local.progress[id], remote.progress[id])
    if (item) progress[id] = item
  }
  return { profile, progress }
}

/** Nothing worth keeping yet: no name and no checklist progress. */
export const isEmpty = (d: SyncData) => !d.profile.firstName.trim() && !d.profile.lastName.trim() && Object.keys(d.progress).length === 0
