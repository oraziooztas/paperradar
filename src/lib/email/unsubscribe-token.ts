// unsubscribe-token.ts — Pure HMAC helpers for one-click email unsubscribe links.
//
// Functional core: depends only on Node's crypto. The route handler and the
// digest sender pass in the secret (resolved from env) so this module stays
// I/O-free and unit-testable. Sign on send, verify on click — both sides use
// the same key, so a token only validates for the user it was minted for.

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Produce the HMAC-SHA256 hex token for a userId, keyed by `secret`.
 * Deterministic: the same (userId, secret) pair always yields the same token.
 */
export function signUnsubscribeToken(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex')
}

/**
 * Verify a token against a userId using a timing-safe comparison.
 * Returns false for any malformed (non-hex / wrong-length) token instead of
 * throwing, so callers can treat the result as a plain boolean.
 */
export function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string
): boolean {
  const expected = signUnsubscribeToken(userId, secret)

  try {
    const tokenBuffer = Buffer.from(token, 'hex')
    const expectedBuffer = Buffer.from(expected, 'hex')
    // Different lengths can't be compared by timingSafeEqual and can't match.
    if (tokenBuffer.length !== expectedBuffer.length) return false
    return timingSafeEqual(tokenBuffer, expectedBuffer)
  } catch {
    return false
  }
}
