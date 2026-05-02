import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './crypto'

describe('crypto', () => {
  it('encrypt returns a non-empty string different from input', () => {
    const result = encrypt('sk-or-test-key-12345')
    expect(result).not.toBe('sk-or-test-key-12345')
    expect(result.length).toBeGreaterThan(0)
  })

  it('decrypt reverses encrypt', () => {
    const original = 'sk-or-v1-abc123xyz'
    const ciphertext = encrypt(original)
    expect(decrypt(ciphertext)).toBe(original)
  })

  it('two encryptions of the same value produce different ciphertexts (random IV)', () => {
    const a = encrypt('same-value')
    const b = encrypt('same-value')
    expect(a).not.toBe(b)
  })

  it('decrypt throws on tampered ciphertext', () => {
    expect(() => decrypt('invalid:tampered:garbage')).toThrow()
  })
})
