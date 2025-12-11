import type {
  Connection,
  ConnectionRawMessage,
  DataUsageEntry,
  WsMsg,
} from '~/types'
import { isNumber } from 'lodash-es'
import { defineStore } from 'pinia'
import { CONNECTIONS_TABLE_MAX_CLOSED_ROWS } from '~/constants'

export const useConnectionsStore = defineStore('connections', () => {
  const globalStore = useGlobalStore()

  // State
  const allConnections = ref<Connection[]>([])
  const activeConnections = ref<Connection[]>([])
  const closedConnections = ref<Connection[]>([])
  const latestConnectionMsg = ref<WsMsg>(null)
  const paused = ref(false)

  // Data usage tracking
  const dataUsageMap = useLocalStorage<Record<string, DataUsageEntry>>(
    'dataUsageMap',
    {},
  )
  const baselineTotals = useLocalStorage<{ upload: number; download: number }>(
    'dataUsageBaseline',
    { upload: 0, download: 0 },
  )

  // Track last known totals to detect service restart
  let lastUploadTotal = 0
  let lastDownloadTotal = 0

  // Track last known data for each connection
  const connectionLastData = new Map<
    string,
    { upload: number; download: number }
  >()
  let hasInitializedSession = false

  // Helper functions
  const restructRawMsgToConnection = (
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

  const mergeAllConnections = (activeConns: Connection[]) => {
    const seen = new Set<string>()
    const merged: Connection[] = []

    // Keep existing order from previous list first
    for (const c of allConnections.value) {
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

    // Trim to latest window
    const limit = activeConns.length + CONNECTIONS_TABLE_MAX_CLOSED_ROWS
    allConnections.value =
      limit > 0 && merged.length > limit ? merged.slice(-limit) : merged
  }

  const diffClosedConnections = (
    activeConns: Connection[],
    allConns: Connection[],
  ) => {
    const activeIds = new Set(activeConns.map((c) => c.id))
    return allConns.filter((c) => !activeIds.has(c.id))
  }

  // Reset connection tracking data
  const resetConnectionTracking = () => {
    connectionLastData.clear()
    baselineTotals.value = { upload: 0, download: 0 }
    hasInitializedSession = false
    console.log('[Data Usage] Connection tracking reset due to service restart')
  }

  // Clear all data usage
  const clearDataUsage = () => {
    dataUsageMap.value = {}
    connectionLastData.clear()
  }

  // Remove specific entry
  const removeDataUsageEntry = (sourceIP: string) => {
    const updates = { ...dataUsageMap.value }
    delete updates[sourceIP]
    dataUsageMap.value = updates
  }

  // Cleanup inactive connections
  const cleanupInactiveConnections = (activeConns?: Connection[]) => {
    const activeConnectionIds = activeConns
      ? new Set(activeConns.map((conn) => conn.id))
      : new Set(allConnections.value.map((conn) => conn.id))

    connectionLastData.forEach((_, connId) => {
      if (!activeConnectionIds.has(connId)) {
        connectionLastData.delete(connId)
      }
    })
  }

  // Update connections from WebSocket message
  const updateFromWsMsg = (msg: WsMsg) => {
    latestConnectionMsg.value = msg
    const rawConns = msg?.connections

    // Detect service restart
    const currentUploadTotal = msg?.uploadTotal || 0
    const currentDownloadTotal = msg?.downloadTotal || 0

    if (
      currentUploadTotal < lastUploadTotal ||
      currentDownloadTotal < lastDownloadTotal
    ) {
      resetConnectionTracking()
      clearDataUsage()
      globalStore.clearChartHistory()
    }

    lastUploadTotal = currentUploadTotal
    lastDownloadTotal = currentDownloadTotal

    if (!rawConns || rawConns.length === 0) return

    const activeConns = restructRawMsgToConnection(
      rawConns,
      activeConnections.value,
    )

    // Update data usage tracking
    updateDataUsage(activeConns)

    // Cleanup inactive connections
    cleanupInactiveConnections(activeConns)

    // Merge all connections
    mergeAllConnections(activeConns)

    if (!paused.value) {
      const closedConns = diffClosedConnections(
        activeConns,
        allConnections.value,
      )
      activeConnections.value = activeConns
      closedConnections.value = closedConns.slice(
        -CONNECTIONS_TABLE_MAX_CLOSED_ROWS,
      )
    }
  }

  // Update data usage
  const updateDataUsage = (connections: Connection[]) => {
    const msg = latestConnectionMsg.value
    // These may be used for future global stats display
    const _currentGlobalUpload = msg?.uploadTotal || 0
    const _currentGlobalDownload = msg?.downloadTotal || 0

    if (!hasInitializedSession) {
      hasInitializedSession = true
    }

    const updates: Record<string, DataUsageEntry> = { ...dataUsageMap.value }
    const now = Date.now()

    const ipDataMap = new Map<
      string,
      { upload: number; download: number; connectionIds: Set<string> }
    >()

    connections.forEach((conn) => {
      const sourceIP = conn.metadata.sourceIP
      if (!sourceIP) return

      const currentUpload = conn.upload || 0
      const currentDownload = conn.download || 0

      if (!ipDataMap.has(sourceIP)) {
        ipDataMap.set(sourceIP, {
          upload: 0,
          download: 0,
          connectionIds: new Set(),
        })
      }

      const ipData = ipDataMap.get(sourceIP)!
      ipData.connectionIds.add(conn.id)

      const lastData = connectionLastData.get(conn.id)

      if (lastData) {
        const uploadDelta = Math.max(0, currentUpload - lastData.upload)
        const downloadDelta = Math.max(0, currentDownload - lastData.download)
        ipData.upload += uploadDelta
        ipData.download += downloadDelta
      } else {
        ipData.upload += currentUpload
        ipData.download += currentDownload
      }

      connectionLastData.set(conn.id, {
        upload: currentUpload,
        download: currentDownload,
      })
    })

    // Update data usage map
    ipDataMap.forEach((data, sourceIP) => {
      const existing = updates[sourceIP]

      if (existing) {
        if (data.upload > 0 || data.download > 0) {
          updates[sourceIP] = {
            ...existing,
            upload: existing.upload + data.upload,
            download: existing.download + data.download,
            total:
              existing.upload +
              data.upload +
              (existing.download + data.download),
            firstSeen: existing.firstSeen || now,
            lastSeen: now,
          }
        } else {
          updates[sourceIP] = { ...existing, lastSeen: now }
        }
      } else if (data.upload > 0 || data.download > 0) {
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

    dataUsageMap.value = updates
  }

  // Computed: speed grouped by proxy name
  const speedGroupByName = computed(() => {
    const returnMap: Record<string, number> = {}

    activeConnections.value.forEach((c) => {
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
    allConnections,
    activeConnections,
    closedConnections,
    latestConnectionMsg,
    paused,
    dataUsageMap,
    speedGroupByName,
    updateFromWsMsg,
    clearDataUsage,
    removeDataUsageEntry,
    restructRawMsgToConnection,
  }
})
