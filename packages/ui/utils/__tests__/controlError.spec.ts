import { describe, expect, it } from 'vitest'
import { controlErrorMessage } from '../controlError'

describe('controlErrorMessage', () => {
  it('prefers the nested H3 validator diagnostic from a ky HTTPError (#2121)', () => {
    const error = Object.assign(
      new Error('Request failed with status code 400'),
      {
        data: {
          statusCode: 400,
          statusMessage: 'profile validation failed',
          data: { error: 'rules[3] GEOIP: database download failed' },
        },
      },
    )

    expect(controlErrorMessage(error)).toBe(
      'rules[3] GEOIP: database download failed',
    )
  })

  it('falls back through the H3 status message and an ordinary Error', () => {
    expect(
      controlErrorMessage({
        data: { statusMessage: 'profile validation failed' },
      }),
    ).toBe('profile validation failed')
    expect(controlErrorMessage(new Error('network down'))).toBe('network down')
  })
})
