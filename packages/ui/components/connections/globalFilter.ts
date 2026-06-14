import type { Connection } from '~/types'

// Fields the connections search box matches against. This mirrors the columns
// shown in the table so a search finds whatever the user can actually see.
//
// The destination IP / remote destination were dropped when the manual filter
// replaced the old fuzzy column filter during the Nuxt migration, which broke
// searching connections by IP address (#2013). They are restored here.
export function connectionMatchesGlobalFilter(
  conn: Connection,
  filter: string,
): boolean {
  const needle = filter.trim().toLowerCase()
  if (!needle) return true

  const haystack = [
    conn.metadata.host,
    conn.metadata.destinationIP,
    conn.metadata.remoteDestination,
    conn.metadata.sourceIP,
    conn.metadata.process,
    conn.rule,
    ...conn.chains,
  ]

  return haystack.some((value) => value?.toLowerCase().includes(needle))
}
