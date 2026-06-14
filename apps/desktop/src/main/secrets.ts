import type { Buffer } from 'node:buffer'
import { randomBytes as nodeRandomBytes } from 'node:crypto'

export type RandomBytesFn = (n: number) => Buffer

/**
 * Generate a hex token. Pure: the randomness source is injectable so the
 * generator is deterministically testable. Default 24 bytes = 48 hex chars.
 */
export function makeToken(
  byteCount = 24,
  randomBytes: RandomBytesFn = nodeRandomBytes,
): string {
  return randomBytes(byteCount).toString('hex')
}
