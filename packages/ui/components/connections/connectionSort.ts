import type { Connection } from '~/types'

export function sortConnections(
  connections: readonly Connection[],
  sortColumn: string,
  sortDesc: boolean,
): Connection[] {
  return [...connections].sort((a, b) => {
    let comparison: number
    switch (sortColumn) {
      case 'ConnectTime':
        comparison = new Date(a.start).getTime() - new Date(b.start).getTime()
        break
      case 'DlSpeed':
        comparison = a.downloadSpeed - b.downloadSpeed
        break
      case 'UlSpeed':
        comparison = a.uploadSpeed - b.uploadSpeed
        break
      case 'Download':
        comparison = a.download - b.download
        break
      case 'Upload':
        comparison = a.upload - b.upload
        break
      case 'Host':
        comparison = (a.metadata.host || '').localeCompare(
          b.metadata.host || '',
        )
        break
      case 'Type':
        comparison = a.metadata.type.localeCompare(b.metadata.type)
        break
      case 'Process':
        comparison = (a.metadata.process || '').localeCompare(
          b.metadata.process || '',
        )
        break
      case 'SourceIP':
        comparison = (a.metadata.sourceIP || '').localeCompare(
          b.metadata.sourceIP || '',
        )
        break
      default:
        // Clearing the sort explicitly preserves the backend's order.
        return 0
    }

    if (comparison) return sortDesc ? -comparison : comparison

    // Snapshots can return the same connections in a different order. Give
    // equal values a deterministic order so tied rows do not jump around or
    // move between pages. Keep this tie-break independent of sort direction.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
