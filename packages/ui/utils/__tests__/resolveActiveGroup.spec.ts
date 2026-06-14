import { describe, expect, it } from 'vitest'
import { resolveActiveGroup } from '../index'

describe('resolveActiveGroup', () => {
  it('keeps current when still present', () => {
    expect(resolveActiveGroup(['A', 'B', 'C'], 'B')).toBe('B')
  })

  it('falls back to first when current is gone', () => {
    expect(resolveActiveGroup(['A', 'B'], 'X')).toBe('A')
  })

  it('falls back to first when current is null', () => {
    expect(resolveActiveGroup(['A', 'B'], null)).toBe('A')
  })

  it('returns null when there are no groups', () => {
    expect(resolveActiveGroup([], 'A')).toBe(null)
  })
})
