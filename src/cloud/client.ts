import type { SupabaseClient } from '@supabase/supabase-js'

// Set at build time (see README). The anon key is designed to be public; row-level security protects the data.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudConfigured = Boolean(url && anonKey)

let client: Promise<SupabaseClient> | null = null

/** Loaded on demand, so the library isn't downloaded on sites that don't have sync set up. */
export function getClient(): Promise<SupabaseClient> {
  if (!cloudConfigured) return Promise.reject(new Error('Sync is not set up for this site.'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url!, anonKey!))
  return client
}

export interface VaultRow {
  salt: string
  iv: string
  ciphertext: string
  updated_at: string
}
