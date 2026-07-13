import { describe, expect, it } from 'vitest'

import { useShareQr } from '../useShareQr'

const remote = (over: { url?: string } = {}) => ({
  id: 'p1',
  name: 'sub',
  type: 'remote' as const,
  updatedAt: 1,
  url: over.url ?? 'https://example.com/sub?token=abc',
})

describe('useShareQr', () => {
  describe('isShareable', () => {
    it('is true for a remote profile with a url', () => {
      const { isShareable } = useShareQr()

      expect(isShareable(remote())).toBe(true)
    })

    it('is false for a remote profile without a url', () => {
      const { isShareable } = useShareQr()

      expect(isShareable({ ...remote(), url: undefined })).toBe(false)
      expect(isShareable({ ...remote(), url: '' })).toBe(false)
    })

    it.each(['local', 'merge', 'script'] as const)(
      'is false for a %s profile even with a url',
      (type) => {
        const { isShareable } = useShareQr()

        expect(isShareable({ ...remote(), type })).toBe(false)
      },
    )
  })

  describe('qrSvg', () => {
    it('renders the url as an svg string', () => {
      const { qrSvg } = useShareQr()

      const svg = qrSvg('https://example.com/sub')

      expect(svg.startsWith('<svg')).toBe(true)
      expect([' ', '>']).toContain(svg[4])
      expect(svg).toContain('</svg>')
      // The matrix has at least one black module rendered as a rect/path.
      expect(svg.includes('<rect') || svg.includes('<path')).toBe(true)
    })

    it('produces different output for different urls', () => {
      const { qrSvg } = useShareQr()

      expect(qrSvg('https://a.example/sub')).not.toBe(
        qrSvg('https://b.example/sub'),
      )
    })

    it('returns an empty string for an empty url', () => {
      const { qrSvg } = useShareQr()

      expect(qrSvg('')).toBe('')
    })
  })
})
