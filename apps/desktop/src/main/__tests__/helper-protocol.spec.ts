import type { HelperRequest, HelperResponse } from '../helper/protocol'
import { describe, expect, it } from 'vitest'
import {
  encodeMessage,
  HELPER_PROTOCOL_VERSION,
  parseMessages,
} from '../helper/protocol'

describe('helper protocol', () => {
  describe('hELPER_PROTOCOL_VERSION', () => {
    it('is a non-empty string constant', () => {
      expect(typeof HELPER_PROTOCOL_VERSION).toBe('string')
      expect(HELPER_PROTOCOL_VERSION.length).toBeGreaterThan(0)
    })
  })

  describe('encodeMessage', () => {
    it('serializes a message to a single newline-terminated JSON line', () => {
      const msg: HelperRequest = {
        type: 'ping',
        secret: 's3cr3t',
        version: HELPER_PROTOCOL_VERSION,
      }

      const line = encodeMessage(msg)

      // exactly one trailing newline, no embedded newlines in the JSON body
      expect(line.endsWith('\n')).toBe(true)
      expect(line.slice(0, -1)).not.toContain('\n')
      expect(JSON.parse(line)).toEqual(msg)
    })
  })

  describe('round-trip', () => {
    it('encode -> parse returns the original message and empty rest', () => {
      const msg: HelperRequest = {
        type: 'startKernel',
        secret: 'abc',
        version: HELPER_PROTOCOL_VERSION,
        binaryPath: '/opt/mihomo',
        homeDir: '/home/.config/mihomo',
        configPath: '/home/.config/mihomo/config.yaml',
      }

      const { messages, rest } = parseMessages(encodeMessage(msg))

      expect(messages).toEqual([msg])
      expect(rest).toBe('')
    })
  })

  describe('parseMessages — framing', () => {
    it('splits multiple coalesced frames into separate messages', () => {
      const a: HelperRequest = {
        type: 'ping',
        secret: 's',
        version: HELPER_PROTOCOL_VERSION,
      }
      const b: HelperRequest = {
        type: 'status',
        secret: 's',
        version: HELPER_PROTOCOL_VERSION,
      }

      const buffer = encodeMessage(a) + encodeMessage(b)
      const { messages, rest } = parseMessages(buffer)

      expect(messages).toEqual([a, b])
      expect(rest).toBe('')
    })

    it('keeps a trailing incomplete fragment in rest (partial frame)', () => {
      const a: HelperRequest = {
        type: 'ping',
        secret: 's',
        version: HELPER_PROTOCOL_VERSION,
      }
      const b: HelperRequest = {
        type: 'getVersion',
        secret: 's',
        version: HELPER_PROTOCOL_VERSION,
      }

      const full = encodeMessage(a) + encodeMessage(b)
      // chop the buffer mid-second-frame: the first frame is complete,
      // the second has no terminating newline yet.
      const cut = full.length - 5
      const { messages, rest } = parseMessages(full.slice(0, cut))

      expect(messages).toEqual([a])
      expect(rest).toBe(full.slice(encodeMessage(a).length, cut))
    })

    it('returns no messages and the whole buffer as rest for a lone partial frame', () => {
      const partial = '{"type":"ping","secret":"s"'
      const { messages, rest } = parseMessages(partial)

      expect(messages).toEqual([])
      expect(rest).toBe(partial)
    })

    it('reassembles a frame split across two parse calls', () => {
      const msg: HelperResponse = {
        type: 'status',
        ok: true,
        version: HELPER_PROTOCOL_VERSION,
        running: true,
      }
      const line = encodeMessage(msg)
      const mid = Math.floor(line.length / 2)

      const first = parseMessages(line.slice(0, mid))
      expect(first.messages).toEqual([])

      const second = parseMessages(first.rest + line.slice(mid))
      expect(second.messages).toEqual([msg])
      expect(second.rest).toBe('')
    })

    it('returns an empty result for an empty buffer', () => {
      const { messages, rest } = parseMessages('')
      expect(messages).toEqual([])
      expect(rest).toBe('')
    })
  })

  describe('message types', () => {
    it('encodes every request variant', () => {
      const requests: HelperRequest[] = [
        { type: 'ping', secret: 's', version: HELPER_PROTOCOL_VERSION },
        { type: 'getVersion', secret: 's', version: HELPER_PROTOCOL_VERSION },
        {
          type: 'startKernel',
          secret: 's',
          version: HELPER_PROTOCOL_VERSION,
          binaryPath: '/bin/mihomo',
          homeDir: '/home',
          configPath: '/home/config.yaml',
        },
        { type: 'stopKernel', secret: 's', version: HELPER_PROTOCOL_VERSION },
        { type: 'status', secret: 's', version: HELPER_PROTOCOL_VERSION },
      ]

      for (const req of requests) {
        const { messages } = parseMessages(encodeMessage(req))
        expect(messages).toEqual([req])
      }
    })

    it('encodes ok and error responses', () => {
      const ok: HelperResponse = {
        type: 'getVersion',
        ok: true,
        version: HELPER_PROTOCOL_VERSION,
      }
      const err: HelperResponse = {
        type: 'startKernel',
        ok: false,
        version: HELPER_PROTOCOL_VERSION,
        error: 'spawn failed',
      }

      expect(parseMessages(encodeMessage(ok)).messages).toEqual([ok])
      expect(parseMessages(encodeMessage(err)).messages).toEqual([err])
    })
  })
})
