import { describe, expect, it } from 'vitest'
import { countryCodeToFlagEmoji, isPrivateOrReservedIP } from '../useGeoLookup'

describe('countryCodeToFlagEmoji', () => {
  it('converts ASCII alpha-2 codes and rejects malformed values', () => {
    expect(countryCodeToFlagEmoji('us')).toBe('🇺🇸')
    expect(countryCodeToFlagEmoji('JP')).toBe('🇯🇵')
    expect(countryCodeToFlagEmoji('U1')).toBe('')
    expect(countryCodeToFlagEmoji('USA')).toBe('')
  })
})

describe('isPrivateOrReservedIP', () => {
  it('classifies IPv4 ranges by parsed octets', () => {
    expect(isPrivateOrReservedIP('10.0.0.1')).toBe(true)
    expect(isPrivateOrReservedIP('169.254.1.1')).toBe(true)
    expect(isPrivateOrReservedIP('8.8.8.8')).toBe(false)
    expect(isPrivateOrReservedIP('999.1.1.1')).toBe(true)
  })

  it('classifies IPv6 ranges by parsed hextets', () => {
    expect(isPrivateOrReservedIP('fd00::1')).toBe(true)
    expect(isPrivateOrReservedIP('fe80::1')).toBe(true)
    expect(isPrivateOrReservedIP('2001:4860:4860::8888')).toBe(false)
    expect(isPrivateOrReservedIP('2001::db8::1')).toBe(true)
  })
})
