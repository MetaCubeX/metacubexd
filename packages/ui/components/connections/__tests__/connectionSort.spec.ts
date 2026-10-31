import type { Connection } from '~/types'
import { describe, expect, it } from 'vitest'
import { sortConnections } from '../connectionSort'

function connection(
  id: string,
  overrides: Partial<Omit<Connection, 'metadata'>> & {
    metadata?: Partial<Connection['metadata']>
  } = {},
): Connection {
  return {
    id,
    download: 0,
    upload: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    chains: [],
    rule: '',
    rulePayload: '',
    start: '2026-11-01T00:00:00.000Z',
    ...overrides,
    metadata: {
      network: 'tcp',
      type: 'HTTP',
      destinationIP: '',
      destinationPort: '443',
      dnsMode: '',
      host: 'example.com',
      inboundIP: '',
      inboundName: '',
      inboundPort: '',
      inboundUser: '',
      process: 'curl',
      processPath: '',
      remoteDestination: '',
      sniffHost: '',
      sourceIP: '10.0.0.1',
      sourcePort: '12345',
      specialProxy: '',
      specialRules: '',
      uid: 0,
      ...overrides.metadata,
    },
  }
}

const sortColumns = [
  'ConnectTime',
  'DlSpeed',
  'UlSpeed',
  'Download',
  'Upload',
  'Host',
  'Type',
  'Process',
  'SourceIP',
]

describe('sortConnections', () => {
  it.each(sortColumns)(
    'keeps tied %s rows in the same order across reordered snapshots',
    (sortColumn) => {
      const initial = [connection('c'), connection('a'), connection('b')]
      // Replace each object, as WebSocket snapshots do, and change fields that
      // are not used by the selected sort to ensure this is not an identity sort.
      const updated = [...initial].reverse().map((conn) => ({
        ...conn,
        metadata: { ...conn.metadata, destinationIP: '1.1.1.1' },
      }))

      for (const descending of [false, true]) {
        const first = sortConnections(initial, sortColumn, descending)
        const next = sortConnections(updated, sortColumn, descending)
        expect(first.map((conn) => conn.id)).toEqual(['a', 'b', 'c'])
        expect(next.map((conn) => conn.id)).toEqual(['a', 'b', 'c'])
        expect(next[0]).toBe(updated[1])
      }
    },
  )

  it.each(sortColumns)(
    'preserves the primary %s ordering and its direction',
    (sortColumn) => {
      // Reverse the ID order to prove that the primary value still takes priority.
      const low = connection('z', {
        start: '2026-11-01T00:00:00.000Z',
        downloadSpeed: 1,
        uploadSpeed: 1,
        download: 1,
        upload: 1,
        metadata: {
          host: 'a.example.com',
          type: 'HTTP',
          process: 'a',
          sourceIP: '10.0.0.1',
        },
      })
      const high = connection('a', {
        start: '2026-11-01T00:00:01.000Z',
        downloadSpeed: 100,
        uploadSpeed: 100,
        download: 100,
        upload: 100,
        metadata: {
          host: 'z.example.com',
          type: 'SOCKS5',
          process: 'z',
          sourceIP: '10.0.0.2',
        },
      })
      expect(sortConnections([high, low], sortColumn, false)).toEqual([
        low,
        high,
      ])
      expect(sortConnections([low, high], sortColumn, true)).toEqual([
        high,
        low,
      ])
    },
  )

  it('keeps same-millisecond connection times stable', () => {
    const a = connection('a', { start: '2026-11-01T00:00:00.123999999Z' })
    const b = connection('b', { start: '2026-11-01T00:00:00.123000001Z' })
    expect(sortConnections([b, a], 'ConnectTime', true)).toEqual([a, b])
    expect(sortConnections([a, b], 'ConnectTime', true)).toEqual([a, b])
  })

  it.each(['', 'unknown'])(
    'preserves snapshot order when the sort is %j',
    (sortColumn) => {
      const rows = [connection('b'), connection('a')]
      for (const descending of [false, true]) {
        expect(sortConnections(rows, sortColumn, descending)).toEqual(rows)
        expect(
          sortConnections([...rows].reverse(), sortColumn, descending),
        ).toEqual([...rows].reverse())
      }
    },
  )

  it('does not mutate the source snapshot', () => {
    const rows = Object.freeze([connection('b'), connection('a')])
    const sorted = sortConnections(rows, 'DlSpeed', false)
    expect(sorted.map((conn) => conn.id)).toEqual(['a', 'b'])
    expect(rows.map((conn) => conn.id)).toEqual(['b', 'a'])
    expect(sorted).not.toBe(rows)
  })
})
