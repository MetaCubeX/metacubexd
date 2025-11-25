import { makePersisted } from '@solid-primitives/storage'
import { isNumber } from 'lodash'
import { CONNECTIONS_TABLE_MAX_CLOSED_ROWS } from '~/constants'
import { clearChartHistory } from '~/signals/global'
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

// Track last known totals to detect service restart
let lastUploadTotal = 0
let lastDownloadTotal = 0

// Global effect to monitor data usage - runs always in background, independent of page
// This effect continuously tracks connection data and updates data usage statistics
// It also detects service restarts by monitoring if total values decrease
createEffect(() => {
  const msg = latestConnectionMsg()
  const rawConns = msg?.connections

  // Detect service restart: totals reset to 0 or decreased significantly
  const currentUploadTotal = msg?.uploadTotal || 0
  const currentDownloadTotal = msg?.downloadTotal || 0

  // If totals decreased, service was restarted - reset all tracking
  // This ensures data usage stats are cleared on service restart, same as TrafficWidget behavior
  if (
    currentUploadTotal < lastUploadTotal ||
    currentDownloadTotal < lastDownloadTotal
  ) {
    // Service restarted, clear connection tracking data and data usage
    resetConnectionTracking()
    clearDataUsage()
    clearChartHistory()
  }

  lastUploadTotal = currentUploadTotal
  lastDownloadTotal = currentDownloadTotal

  if (!rawConns || rawConns.length === 0) {
    return
  }

  untrack(() => {
    // Get previous connections for speed calculation
    const prevConns = allConnections()
    const activeConns = restructRawMsgToConnection(rawConns, prevConns)

    // Update data usage tracking - accumulates data per source IP
    updateDataUsage(activeConns)

    // Cleanup inactive connection tracking data periodically
    cleanupInactiveConnections(activeConns)
  })
})

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

      // Merge using freshly computed activeConns (previous code mistakenly used stale activeConnections())
      mergeAllConnections(activeConns)

      if (!paused()) {
        const closedConns = diffClosedConnections(activeConns, allConnections())

        setActiveConnections(activeConns)
        setClosedConnections(
          closedConns.slice(-CONNECTIONS_TABLE_MAX_CLOSED_ROWS),
        )
      }

      // Trimming now handled inside mergeAllConnections; removed redundant slice
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
  // O(n) merge using Set to avoid repeated unionWith comparator per item
  setAllConnections((prevAll) => {
    const seen = new Set<string>()
    const merged: Connection[] = []

    // Keep existing order from previous list first
    for (const c of prevAll) {
      if (!seen.has(c.id)) {
        seen.add(c.id)
        merged.push(c)
      }
    }

    // Append new active connections not yet seen
    for (const c of activeConns) {
      if (!seen.has(c.id)) {
        seen.add(c.id)
        merged.push(c)
      }
    }

    // Trim to latest window: active + max closed
    const limit = activeConns.length + CONNECTIONS_TABLE_MAX_CLOSED_ROWS

    return limit > 0 && merged.length > limit ? merged.slice(-limit) : merged
  })
}

const diffClosedConnections = (
  activeConns: Connection[],
  allConns: Connection[],
) => {
  // O(n) difference using Set of active IDs
  const activeIds = new Set(activeConns.map((c) => c.id))

  return allConns.filter((c) => !activeIds.has(c.id))
}

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

// Store baseline totals from backend to calculate incremental changes across browser sessions
export const [baselineTotals, setBaselineTotals] = makePersisted(
  createSignal<{ upload: number; download: number }>({
    upload: 0,
    download: 0,
  }),
  {
    name: 'dataUsageBaseline',
    storage: localStorage,
  },
)

// Track last known data for each connection to calculate incremental changes
const connectionLastData = new Map<
  string,
  { upload: number; download: number }
>()

// Track if session has been initialized
let hasInitializedSession = false

// Reset connection tracking data when service restarts
export const resetConnectionTracking = () => {
  connectionLastData.clear()
  setBaselineTotals({ upload: 0, download: 0 })
  hasInitializedSession = false
  console.log(
    '[Data Usage] Connection tracking reset due to service restart. Data usage map will be cleared.',
  )
}

// Update data usage statistics by tracking incremental changes per connection
// This function is called continuously in the background to accumulate data usage per IP
// The accumulated totals are persisted in localStorage and synced with TrafficWidget behavior
export const updateDataUsage = (connections: Connection[]) => {
  const msg = latestConnectionMsg()
  const currentGlobalUpload = msg?.uploadTotal || 0
  const currentGlobalDownload = msg?.downloadTotal || 0

  // Initialize session baseline on first run
  if (!hasInitializedSession) {
    const baseline = baselineTotals()
    hasInitializedSession = true
    console.log(
      '[Data Usage] Session initialized. Baseline:',
      baseline,
      'Current global:',
      { upload: currentGlobalUpload, download: currentGlobalDownload },
    )
  }

  const updates: Record<string, DataUsageEntry> = { ...dataUsageMap() }
  const now = Date.now()

  // Group connections by source IP and use their current cumulative data
  const ipDataMap = new Map<
    string,
    {
      upload: number
      download: number
      connectionIds: Set<string>
    }
  >()

  connections.forEach((conn) => {
    const sourceIP = conn.metadata.sourceIP

    if (!sourceIP) return

    const currentUpload = conn.upload || 0
    const currentDownload = conn.download || 0

    // Track connection IDs per IP
    if (!ipDataMap.has(sourceIP)) {
      ipDataMap.set(sourceIP, {
        upload: 0,
        download: 0,
        connectionIds: new Set(),
      })
    }

    const ipData = ipDataMap.get(sourceIP)!
    ipData.connectionIds.add(conn.id)

    // Get last known data for this connection
    const lastData = connectionLastData.get(conn.id)

    if (lastData) {
      // Calculate incremental change from last known state
      // Only count positive deltas to avoid negative values on connection resets
      const uploadDelta = Math.max(0, currentUpload - lastData.upload)
      const downloadDelta = Math.max(0, currentDownload - lastData.download)

      ipData.upload += uploadDelta
      ipData.download += downloadDelta
    } else {
      // First time seeing this connection, add its current cumulative data
      ipData.upload += currentUpload
      ipData.download += currentDownload
    }

    // Update last known data for this connection
    connectionLastData.set(conn.id, {
      upload: currentUpload,
      download: currentDownload,
    })
  })

  // Update baseline totals based on current global totals
  // This ensures data persists across browser sessions
  const totalTracked = Object.values(updates).reduce(
    (acc, entry) => ({
      upload: acc.upload + entry.upload,
      download: acc.download + entry.download,
    }),
    { upload: 0, download: 0 },
  )

  // Add new data from this update cycle
  ipDataMap.forEach((data) => {
    totalTracked.upload += data.upload
    totalTracked.download += data.download
  })

  // Update baseline to reflect all data we've tracked so far
  setBaselineTotals({
    upload: totalTracked.upload,
    download: totalTracked.download,
  })

  // Update data usage map with accumulated changes
  ipDataMap.forEach((data, sourceIP) => {
    const existing = updates[sourceIP]

    if (existing) {
      // Only update if there's actual new data
      if (data.upload > 0 || data.download > 0) {
        updates[sourceIP] = {
          ...existing,
          upload: existing.upload + data.upload,
          download: existing.download + data.download,
          total:
            existing.upload + data.upload + (existing.download + data.download),
          firstSeen: existing.firstSeen || now,
          lastSeen: now,
        }
      } else {
        // Just update lastSeen to show it's still active
        updates[sourceIP] = {
          ...existing,
          lastSeen: now,
        }
      }
    } else {
      // New IP entry
      if (data.upload > 0 || data.download > 0) {
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
    }
  })

  setDataUsageMap(updates)
}

// Clear all data usage statistics and reset connection tracking
// This is called on manual clear or automatic service restart detection
export const clearDataUsage = () => {
  setDataUsageMap({})
  connectionLastData.clear()
}

// Remove a specific IP entry from data usage tracking
export const removeDataUsageEntry = (sourceIP: string) => {
  setDataUsageMap((prev) => {
    const updates = { ...prev }

    delete updates[sourceIP]

    return updates
  })
}

// Cleanup tracking data for connections that no longer exist
// This prevents memory leaks from accumulating stale connection data
export const cleanupInactiveConnections = (activeConns?: Connection[]) => {
  const activeConnectionIds = activeConns
    ? new Set(activeConns.map((conn) => conn.id))
    : new Set(allConnections().map((conn) => conn.id))

  // Remove tracking data for connections that no longer exist
  connectionLastData.forEach((_, connId) => {
    if (!activeConnectionIds.has(connId)) {
      connectionLastData.delete(connId)
    }
  })
}
