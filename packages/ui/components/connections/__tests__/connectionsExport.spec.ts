import type { Connection } from '~/types'
import { describe, expect, it } from 'vitest'
import { connectionsToCSV, connectionsToJSON } from '../connectionsExport'

function createConnection(overrides: {
  id?: string
  download?: number
  upload?: number
  downloadSpeed?: number
  uploadSpeed?: number
  start?: string
  rule?: string
  rulePayload?: string
  chains?: string[]
  metadata?: Partial<Connection['metadata']>
}): Connection {
  return {
    id: overrides.id ?? 'conn-1',
    download: overrides.download ?? 0,
    upload: overrides.upload ?? 0,
    downloadSpeed: overrides.downloadSpeed ?? 0,
    uploadSpeed: overrides.uploadSpeed ?? 0,
    chains: overrides.chains ?? [],
    rule: overrides.rule ?? '',
    rulePayload: overrides.rulePayload ?? '',
    start: overrides.start ?? '2026-06-15T00:00:00.000Z',
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
      process: 'firefox',
      processPath: '',
      remoteDestination: '',
      sniffHost: '',
      sourceIP: '10.0.0.5',
      sourcePort: '51234',
      specialProxy: '',
      specialRules: '',
      uid: 0,
      ...overrides.metadata,
    },
  }
}

describe('connectionsToJSON', () => {
  it('serializes the provided (already filtered/sorted) connections array as JSON', () => {
    const conns = [createConnection({ id: 'a' }), createConnection({ id: 'b' })]
    const out = connectionsToJSON(conns)
    const parsed = JSON.parse(out) as Connection[]
    expect(parsed).toHaveLength(2)
    expect(parsed[0]!.id).toBe('a')
    expect(parsed[1]!.id).toBe('b')
  })

  it('respects the active filter by only serializing the rows it is given', () => {
    const conns = [createConnection({ id: 'only-this-one' })]
    const parsed = JSON.parse(connectionsToJSON(conns)) as Connection[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.id).toBe('only-this-one')
  })

  it('produces valid JSON for an empty list', () => {
    expect(JSON.parse(connectionsToJSON([]))).toEqual([])
  })
})

describe('connectionsToCSV', () => {
  it('emits a header row followed by one row per connection', () => {
    const conns = [
      createConnection({ id: 'a', metadata: { host: 'a.example.com' } }),
      createConnection({ id: 'b', metadata: { host: 'b.example.com' } }),
    ]
    const lines = connectionsToCSV(conns).split('\n')
    expect(lines).toHaveLength(3) // header + 2 rows
    expect(lines[0]).toContain('id')
    expect(lines[0]).toContain('host')
    expect(lines[1]).toContain('a.example.com')
    expect(lines[2]).toContain('b.example.com')
  })

  it('quotes and escapes fields containing commas, quotes and newlines (RFC 4180)', () => {
    const conn = createConnection({
      id: 'x',
      rule: 'DOMAIN,SUFFIX',
      metadata: { host: 'has "quote"' },
    })
    const csv = connectionsToCSV([conn])
    const rows = csv.split('\n')
    // the rule field with a comma must be wrapped in double quotes
    expect(rows[1]).toContain('"DOMAIN,SUFFIX"')
    // the embedded double quote must be doubled and the field quoted
    expect(rows[1]).toContain('"has ""quote"""')
  })

  it('joins proxy chains into a single readable cell', () => {
    const conn = createConnection({ chains: ['PROXY', 'Auto'] })
    const csv = connectionsToCSV([conn])
    // chains are rendered outbound-first in the UI; the CSV mirrors that order
    expect(csv).toContain('Auto')
    expect(csv).toContain('PROXY')
  })

  it('emits just the header row for an empty list', () => {
    const csv = connectionsToCSV([])
    expect(csv.split('\n')).toHaveLength(1)
    expect(csv).toContain('id')
  })
})
