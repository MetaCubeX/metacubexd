import type { Connection } from '~/types'
import { describe, expect, it } from 'vitest'
import { connectionMatchesGlobalFilter } from '../globalFilter'

function createConnection(overrides: {
  metadata?: Partial<Connection['metadata']>
  rule?: string
  chains?: string[]
}): Connection {
  return {
    id: 'conn-1',
    download: 0,
    upload: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    chains: overrides.chains ?? [],
    rule: overrides.rule ?? '',
    rulePayload: '',
    start: '',
    metadata: {
      network: '',
      type: '',
      destinationIP: '',
      destinationPort: '',
      dnsMode: '',
      host: '',
      inboundIP: '',
      inboundName: '',
      inboundPort: '',
      inboundUser: '',
      process: '',
      processPath: '',
      remoteDestination: '',
      sniffHost: '',
      sourceIP: '',
      sourcePort: '',
      specialProxy: '',
      specialRules: '',
      uid: 0,
      ...overrides.metadata,
    },
  }
}

describe('connectionMatchesGlobalFilter', () => {
  it('matches by destination IP (#2013 regression)', () => {
    const conn = createConnection({
      metadata: { destinationIP: '192.168.1.100' },
    })
    expect(connectionMatchesGlobalFilter(conn, '192.168.1.100')).toBe(true)
    expect(connectionMatchesGlobalFilter(conn, '192.168.1.')).toBe(true)
  })

  it('matches by remote destination', () => {
    const conn = createConnection({
      metadata: { remoteDestination: '203.0.113.7' },
    })
    expect(connectionMatchesGlobalFilter(conn, '203.0.113.7')).toBe(true)
  })

  it('still matches by host, source IP, process, rule and chains', () => {
    const conn = createConnection({
      metadata: {
        host: 'example.com',
        sourceIP: '10.0.0.5',
        process: 'firefox',
      },
      rule: 'DOMAIN-SUFFIX',
      chains: ['PROXY', 'Auto'],
    })
    expect(connectionMatchesGlobalFilter(conn, 'example.com')).toBe(true)
    expect(connectionMatchesGlobalFilter(conn, '10.0.0.5')).toBe(true)
    expect(connectionMatchesGlobalFilter(conn, 'firefox')).toBe(true)
    expect(connectionMatchesGlobalFilter(conn, 'domain-suffix')).toBe(true)
    expect(connectionMatchesGlobalFilter(conn, 'auto')).toBe(true)
  })

  it('is case-insensitive', () => {
    const conn = createConnection({ metadata: { host: 'Example.COM' } })
    expect(connectionMatchesGlobalFilter(conn, 'example.com')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    const conn = createConnection({
      metadata: { destinationIP: '192.168.1.100', host: 'example.com' },
    })
    expect(connectionMatchesGlobalFilter(conn, '8.8.8.8')).toBe(false)
  })

  it('matches everything for an empty filter', () => {
    const conn = createConnection({})
    expect(connectionMatchesGlobalFilter(conn, '')).toBe(true)
    expect(connectionMatchesGlobalFilter(conn, '   ')).toBe(true)
  })
})
