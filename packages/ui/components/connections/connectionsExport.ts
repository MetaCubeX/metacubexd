import type { Connection } from '~/types'

// Connection export (desktop + web). The page hands these helpers the CURRENT
// list — already filtered, sorted and tab-scoped — so the export always mirrors
// exactly what the user sees. Serialization is kept here (and unit-tested) so the
// page only owns the Blob/anchor download plumbing.

// JSON export: the raw connection objects, pretty-printed.
export function connectionsToJSON(connections: Connection[]): string {
  return JSON.stringify(connections, null, 2)
}

// The flat columns we emit to CSV — one human-readable cell per field. Chains are
// rendered outbound-first (reversed), matching the table's chain column.
const CSV_COLUMNS: Array<{
  header: string
  value: (conn: Connection) => string | number
}> = [
  { header: 'id', value: (c) => c.id },
  { header: 'type', value: (c) => c.metadata.type },
  { header: 'network', value: (c) => c.metadata.network },
  { header: 'host', value: (c) => c.metadata.host },
  { header: 'destinationIP', value: (c) => c.metadata.destinationIP },
  { header: 'destinationPort', value: (c) => c.metadata.destinationPort },
  { header: 'sourceIP', value: (c) => c.metadata.sourceIP },
  { header: 'sourcePort', value: (c) => c.metadata.sourcePort },
  { header: 'process', value: (c) => c.metadata.process },
  { header: 'rule', value: (c) => c.rule },
  { header: 'rulePayload', value: (c) => c.rulePayload },
  { header: 'chains', value: (c) => [...c.chains].reverse().join(' -> ') },
  { header: 'download', value: (c) => c.download },
  { header: 'upload', value: (c) => c.upload },
  { header: 'downloadSpeed', value: (c) => c.downloadSpeed },
  { header: 'uploadSpeed', value: (c) => c.uploadSpeed },
  { header: 'start', value: (c) => c.start },
]

// Escape a single CSV field per RFC 4180: wrap in double quotes when it contains
// a comma, quote or newline, doubling any embedded quotes.
function escapeCSVField(value: string | number): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// CSV export: a header row followed by one row per connection. An empty list
// still emits the header row so the file documents its own schema.
export function connectionsToCSV(connections: Connection[]): string {
  const header = CSV_COLUMNS.map((col) => col.header).join(',')
  const rows = connections.map((conn) =>
    CSV_COLUMNS.map((col) => escapeCSVField(col.value(conn))).join(','),
  )
  return [header, ...rows].join('\n')
}
