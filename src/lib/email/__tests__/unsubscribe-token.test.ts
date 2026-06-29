import { describe, it, expect } from 'vitest'
import { signUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

const SECRET = 'test-signing-secret'

describe('signUnsubscribeToken', () => {
  it('produces a 64-char lowercase hex digest (HMAC-SHA256)', () => {
    const token = signUnsubscribeToken('user-123', SECRET)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same userId + secret', () => {
    expect(signUnsubscribeToken('user-123', SECRET)).toBe(
      signUnsubscribeToken('user-123', SECRET)
    )
  })

  it('changes when the userId changes', () => {
    expect(signUnsubscribeToken('user-123', SECRET)).not.toBe(
      signUnsubscribeToken('user-456', SECRET)
    )
  })

  it('changes when the secret changes', () => {
    expect(signUnsubscribeToken('user-123', SECRET)).not.toBe(
      signUnsubscribeToken('user-123', 'a-different-secret')
    )
  })
})

describe('verifyUnsubscribeToken', () => {
  it('accepts a token it just signed (round-trip)', () => {
    const token = signUnsubscribeToken('user-123', SECRET)
    expect(verifyUnsubscribeToken('user-123', token, SECRET)).toBe(true)
  })

  it('rejects a token minted for a different user', () => {
    const token = signUnsubscribeToken('user-456', SECRET)
    expect(verifyUnsubscribeToken('user-123', token, SECRET)).toBe(false)
  })

  it('rejects a token signed with a different secret', () => {
    const token = signUnsubscribeToken('user-123', 'other-secret')
    expect(verifyUnsubscribeToken('user-123', token, SECRET)).toBe(false)
  })

  it('rejects an empty token', () => {
    expect(verifyUnsubscribeToken('user-123', '', SECRET)).toBe(false)
  })

  it('rejects a malformed (non-hex) token without throwing', () => {
    expect(verifyUnsubscribeToken('user-123', 'not-hex-zzzz', SECRET)).toBe(false)
  })

  it('rejects a hex token of the wrong length', () => {
    expect(verifyUnsubscribeToken('user-123', 'abcd', SECRET)).toBe(false)
  })

  it('rejects a same-length but wrong token (timing-safe path)', () => {
    expect(verifyUnsubscribeToken('user-123', '0'.repeat(64), SECRET)).toBe(false)
  })
})
