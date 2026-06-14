import { describe, expect, it } from 'vitest'
import { shouldStartHidden } from '../startup'

describe('shouldStartHidden', () => {
  it('returns true when argv includes --hidden', () => {
    expect(shouldStartHidden(['electron', '.', '--hidden'], {})).toBe(true)
  })

  it('returns true when the app was opened at login', () => {
    expect(
      shouldStartHidden(['electron', '.'], { wasOpenedAtLogin: true }),
    ).toBe(true)
  })

  it('returns true when both the flag and the login signal are present', () => {
    expect(
      shouldStartHidden(['electron', '.', '--hidden'], {
        wasOpenedAtLogin: true,
      }),
    ).toBe(true)
  })

  it('returns false for a normal foreground launch', () => {
    expect(shouldStartHidden(['electron', '.'], {})).toBe(false)
  })

  it('returns false when wasOpenedAtLogin is explicitly false and no flag', () => {
    expect(
      shouldStartHidden(['electron', '.'], { wasOpenedAtLogin: false }),
    ).toBe(false)
  })

  it('returns false when wasOpenedAtLogin is undefined and no flag', () => {
    expect(
      shouldStartHidden(['electron', '.'], { wasOpenedAtLogin: undefined }),
    ).toBe(false)
  })

  it('only treats the exact --hidden token as the hidden flag', () => {
    expect(shouldStartHidden(['electron', '.', '--hiddenish'], {})).toBe(false)
    expect(shouldStartHidden(['electron', '.', 'hidden'], {})).toBe(false)
  })
})
