import { describe, expect, it } from 'vitest'
import { b64, decryptJson, deriveAuthSecret, deriveKey, encryptJson, newSalt } from './crypto'

describe('sync encryption', () => {
  it('round-trips data and never stores it readable', async () => {
    const key = await deriveKey('correct horse 1', newSalt())
    const { iv, ciphertext } = await encryptJson(key, { firstName: 'Jordan' })
    expect(new TextDecoder().decode(b64.from(ciphertext))).not.toContain('Jordan')
    expect(await decryptJson(key, iv, ciphertext)).toEqual({ firstName: 'Jordan' })
  })

  it('refuses the wrong password', async () => {
    const salt = newSalt()
    const { iv, ciphertext } = await encryptJson(await deriveKey('correct horse 1', salt), { a: 1 })
    await expect(decryptJson(await deriveKey('wrong password', salt), iv, ciphertext)).rejects.toThrow()
  })

  it('derives a stable sign-in secret that is not the password', async () => {
    const a = await deriveAuthSecret(' Jordan@Example.com ', 'correct horse 1')
    expect(a).toBe(await deriveAuthSecret('jordan@example.com', 'correct horse 1'))
    expect(a).not.toBe(await deriveAuthSecret('someone@example.com', 'correct horse 1'))
    expect(a).not.toContain('correct horse')
  })
})
