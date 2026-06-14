import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { makeToken } from '../secrets'

describe('makeToken', () => {
  it('hex-encodes the bytes returned by the injected randomBytes fn', () => {
    const randomBytes = (n: number) => Buffer.alloc(n, 0xAB)
    expect(makeToken(4, randomBytes)).toBe('abababab')
  })

  it('produces a token of length 2 * byteCount', () => {
    const randomBytes = (n: number) => Buffer.alloc(n, 0x00)
    expect(makeToken(16, randomBytes)).toHaveLength(32)
  })

  it('uses 24 bytes (48 hex chars) by default', () => {
    let asked = -1
    const randomBytes = (n: number) => {
      asked = n
      return Buffer.alloc(n, 0x01)
    }
    const token = makeToken(undefined, randomBytes)
    expect(asked).toBe(24)
    expect(token).toHaveLength(48)
  })
})
