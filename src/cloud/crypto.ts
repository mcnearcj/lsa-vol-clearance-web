// Client-side encryption for the optional cloud copy. The passphrase and key never leave the browser;
// the server only ever stores salt, iv and ciphertext.

const ITERATIONS = 600_000
const enc = new TextEncoder()
const dec = new TextDecoder()

export const b64 = {
  to(bytes: Uint8Array): string {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
  },
  from(text: string): Uint8Array<ArrayBuffer> {
    const s = atob(text)
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  },
}

export function newSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(16))
}

export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return { iv: b64.to(iv), ciphertext: b64.to(new Uint8Array(data)) }
}

/** Throws if the passphrase is wrong or the data was tampered with (AES-GCM authenticates). */
export async function decryptJson<T>(key: CryptoKey, iv: string, ciphertext: string): Promise<T> {
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.from(iv) }, key, b64.from(ciphertext))
  return JSON.parse(dec.decode(data)) as T
}

/**
 * Turns the volunteer's one password into the secret sent to the sign-in service. The service never sees the
 * password itself, so it can't derive the encryption key (which uses a different, random salt).
 */
export async function deriveAuthSecret(email: string, password: string): Promise<string> {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const salt = enc.encode(`lsa-vol-clearance:auth:${email.trim().toLowerCase()}`)
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, 256)
  return b64.to(new Uint8Array(bits))
}
