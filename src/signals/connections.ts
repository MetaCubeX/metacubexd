import { makePersisted } from '@solid-primitives/storage'
import { differenceWith, isNumber, unionWith } from 'lodash'
import { CONNECTIONS_TABLE_MAX_CLOSED_ROWS } from '~/constants'
import { Connection, ConnectionRawMessage, DataUsageEntry } from '~/types'

export type WsMsg = {
  connections?: ConnectionRawMessage[]
  uploadTotal: number
  downloadTotal: number
} | null

// DIRECT is from clash
// direct and dns-out is from the example of sing-box official site
export const [quickFilterRegex, setQuickFilterRegex] = makePersisted(
  createSignal<string>('DIRECT|direct|dns-out'),
  {
    name: 'quickFilterRegex',
    storage: localStorage,
  },
)

// we make connections global, so we can keep track of connections when user in proxy page
// when user selects proxy and close some connections they can back and check connections
// they closed
export const [allConnections, setAllConnections] = createSignal<Connection[]>(
  [],
)

export const [latestConnectionMsg, setLatestConnectionMsg] =
  createSignal<WsMsg>(null)

export const useConnections = () => {
  const [closedConnections, setClosedConnections] = createSignal<Connection[]>(
    [],
  )
  const [activeConnections, setActiveConnections] = createSignal<Connection[]>(
    [],
  )
  const [paused, setPaused] = createSignal(false)

  createEffect(() => {
    const rawConns = latestConnectionMsg()?.connections

    if (!rawConns) {
      return
    }

    untrack(() => {
      const activeConns = restructRawMsgToConnection(
        rawConns,
        activeConnections(),
      )

      mergeAllConnections(activeConnections())

      if (!paused()) {
        const closedConns = diffClosedConnections(activeConns, allConnections())

        setActiveConnections(activeConns)
        setClosedConnections(
          closedConns.slice(-CONNECTIONS_TABLE_MAX_CLOSED_ROWS),
        )
      }

      setAllConnections((allConnections) =>
        allConnections.slice(
          -(activeConns.length + CONNECTIONS_TABLE_MAX_CLOSED_ROWS),
        ),
      )

      // Update data usage with active connections
      updateDataUsage(activeConns)

      // Cleanup inactive connection tracking data periodically
      cleanupInactiveConnections()
    })
  })

  const speedGroupByName = createMemo(() => {
    const returnMap: Record<string, number> = {}

    activeConnections().forEach((c) => {
      c.chains.forEach((chain) => {
        if (!returnMap[chain]) {
          returnMap[chain] = 0
        }

        returnMap[chain] += c.downloadSpeed
      })
    })

    return returnMap
  })

  return {
    closedConnections,
    activeConnections,
    speedGroupByName,
    paused,
    setPaused,
  }
}

export const restructRawMsgToConnection = (
  connections: ConnectionRawMessage[],
  prevActiveConnections: Connection[],
): Connection[] => {
  const prevMap = new Map<string, Connection>()
  prevActiveConnections.forEach((prev) => prevMap.set(prev.id, prev))

  return connections.map((connection) => {
    const prevConn = prevMap.get(connection.id)

    if (
      !prevConn ||
      !isNumber(prevConn.download) ||
      !isNumber(prevConn.upload)
    ) {
      return { ...connection, downloadSpeed: 0, uploadSpeed: 0 }
    }

    return {
      ...connection,
      downloadSpeed: connection.download - prevConn.download,
      uploadSpeed: connection.upload - prevConn.upload,
    }
  })
}

export const mergeAllConnections = (activeConns: Connection[]) => {
  setAllConnections((allConnections) =>
    unionWith(allConnections, activeConns, (a, b) => a.id === b.id),
  )
}

const diffClosedConnections = (
  activeConns: Connection[],
  allConns: Connection[],
) => differenceWith(allConns, activeConns, (a, b) => a.id === b.id)

// Data Usage tracking
const migrateDataUsageMap = (
  data: Record<string, DataUsageEntry>,
): Record<string, DataUsageEntry> => {
  const migrated: Record<string, DataUsageEntry> = {}

  Object.entries(data).forEach(([key, entry]) => {
    // Migrate old entries without firstSeen
    if (!entry.firstSeen) {
      migrated[key] = {
        ...entry,
        firstSeen: entry.lastSeen || Date.now(),
      }
    } else {
      migrated[key] = entry
    }
  })

  return migrated
}

export const [dataUsageMap, setDataUsageMap] = makePersisted(
  createSignal<Record<string, DataUsageEntry>>({}),
  {
    name: 'dataUsageMap',
    storage: localStorage,
    deserialize: (value: string) => {
      const parsed = JSON.parse(value)

      return migrateDataUsageMap(parsed)
    },
  },
)

// Track last known data for each connection to calculate incremental changes
const connectionLastData = new Map<
  string,
  { upload: number; download: number }
>()

export const updateDataUsage = (connections: Connection[]) => {
  const updates: Record<string, DataUsageEntry> = { ...dataUsageMap() }

  // Group connections by source IP and sum their current data
  const ipDataMap = new Map<string, { upload: number; download: number }>()

  connections.forEach((conn) => {
    const sourceIP = conn.metadata.sourceIP

    if (!sourceIP) return

    const currentUpload = conn.upload || 0
    const currentDownload = conn.download || 0

    // Get last known data for this connection
    const lastData = connectionLastData.get(conn.id)

    // Calculate incremental change
    let uploadDelta = 0
    let downloadDelta = 0

    if (lastData) {
      uploadDelta = currentUpload - lastData.upload
      downloadDelta = currentDownload - lastData.download
    } else {
      // First time seeing this connection, use full amount
      uploadDelta = currentUpload
      downloadDelta = currentDownload
    }

    // Update last known data
    connectionLastData.set(conn.id, {
      upload: currentUpload,
      download: currentDownload,
    })

    // Accumulate data per IP
    if (!ipDataMap.has(sourceIP)) {
      ipDataMap.set(sourceIP, {
        upload: 0,
        download: 0,
      })
    }

    const ipData = ipDataMap.get(sourceIP)!

    ipData.upload += uploadDelta
    ipData.download += downloadDelta
  })

  // Update data usage map with accumulated changes
  ipDataMap.forEach((data, sourceIP) => {
    const existing = updates[sourceIP]
    const now = Date.now()

    if (existing) {
      updates[sourceIP] = {
        ...existing,
        upload: existing.upload + data.upload,
        download: existing.download + data.download,
        total:
          existing.upload + data.upload + existing.download + data.download,
        firstSeen: existing.firstSeen || now, // Ensure firstSeen exists
        lastSeen: now,
      }
    } else {
      updates[sourceIP] = {
        sourceIP,
        macAddress: '',
        upload: data.upload,
        download: data.download,
        total: data.upload + data.download,
        firstSeen: now,
        lastSeen: now,
      }
    }
  })

  setDataUsageMap(updates)
}

export const clearDataUsage = () => {
  setDataUsageMap({})
  connectionLastData.clear()
}

export const removeDataUsageEntry = (sourceIP: string) => {
  setDataUsageMap((prev) => {
    const updates = { ...prev }

    delete updates[sourceIP]

    return updates
  })
}

export const cleanupInactiveConnections = () => {
  const activeConnectionIds = new Set(allConnections().map((conn) => conn.id))

  // Remove tracking data for connections that no longer exist
  connectionLastData.forEach((_, connId) => {
    if (!activeConnectionIds.has(connId)) {
      connectionLastData.delete(connId)
    }
  })
}
