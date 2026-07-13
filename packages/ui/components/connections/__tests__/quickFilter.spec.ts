import { describe, expect, it } from 'vitest'
import { chainMatchesQuickFilter, parseQuickFilterTerms } from '../quickFilter'

describe('connection quick filter', () => {
  it('parses pipe, comma, and newline separated literal terms', () => {
    expect(parseQuickFilterTerms(' DIRECT | dns-out, Reject\nproxy ')).toEqual([
      'direct',
      'dns-out',
      'reject',
      'proxy',
    ])
  })

  it('matches literal text case-insensitively', () => {
    const terms = parseQuickFilterTerms('direct|dns-out')
    expect(chainMatchesQuickFilter(['DIRECT'], terms)).toBe(true)
    expect(chainMatchesQuickFilter(['my-DNS-OUT-node'], terms)).toBe(true)
    expect(chainMatchesQuickFilter(['Proxy A'], terms)).toBe(false)
  })

  it('treats pattern punctuation literally', () => {
    const terms = parseQuickFilterTerms('node.*')
    expect(chainMatchesQuickFilter(['node.*'], terms)).toBe(true)
    expect(chainMatchesQuickFilter(['node-123'], terms)).toBe(false)
  })
})
