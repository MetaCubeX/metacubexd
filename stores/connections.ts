import type {
  Connection,
  ConnectionRawMessage,
  DataUsageEntry,
  DataUsageType,
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
  const dataUsageMap = useLocalStorage<
    Record<DataUsageType, Record<string, DataUsageEntry>>
  >('dataUsageMap', {
    sourceIP: {},
    host: {},
    process: {},
    outbound: {},
  })
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
        // Preserve existing speed values if present (e.g., from mock data)
        const conn = connection as Connection
        return {
          ...connection,
          downloadSpeed: conn.downloadSpeed ?? 0,
          uploadSpeed: conn.uploadSpeed ?? 0,
        }
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
    dataUsageMap.value = {
      sourceIP: {},
      host: {},
      process: {},
      outbound: {},
    }
    connectionLastData.clear()
  }

  // Remove specific entry
  const removeDataUsageEntry = (type: DataUsageType, id: string) => {
    const updates = { ...dataUsageMap.value }
    const typeUpdates = { ...updates[type] }
    delete typeUpdates[id]
    updates[type] = typeUpdates
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

    const updates = { ...dataUsageMap.value }
    const now = Date.now()

    const deltaMap = {
      sourceIP: new Map<string, { upload: number; download: number }>(),
      host: new Map<string, { upload: number; download: number }>(),
      process: new Map<string, { upload: number; download: number }>(),
      outbound: new Map<string, { upload: number; download: number }>(),
    }

    connections.forEach((conn) => {
      const currentUpload = conn.upload || 0
      const currentDownload = conn.download || 0
      let uploadDelta = 0
      let downloadDelta = 0

      const lastData = connectionLastData.get(conn.id)

      if (lastData) {
        uploadDelta = Math.max(0, currentUpload - lastData.upload)
        downloadDelta = Math.max(0, currentDownload - lastData.download)
      } else {
        uploadDelta = currentUpload
        downloadDelta = currentDownload
      }

      connectionLastData.set(conn.id, {
        upload: currentUpload,
        download: currentDownload,
      })

      if (uploadDelta === 0 && downloadDelta === 0) return

      const addToMap = (type: DataUsageType, id: string | undefined) => {
        if (!id) return
        if (!deltaMap[type].has(id)) {
          deltaMap[type].set(id, { upload: 0, download: 0 })
        }
        const entry = deltaMap[type].get(id)!
        entry.upload += uploadDelta
        entry.download += downloadDelta
      }

      addToMap('sourceIP', conn.metadata.sourceIP || 'Inner')
      addToMap('host', conn.metadata.host || conn.metadata.destinationIP)
      addToMap('process', conn.metadata.process || 'Unknown')

      const outbound =
        conn.chains && conn.chains.length > 0 ? conn.chains[0] : 'DIRECT'
      addToMap('outbound', outbound)
    })

    // Update data usage map
    ;(Object.keys(deltaMap) as DataUsageType[]).forEach((type) => {
      const typeDeltas = deltaMap[type]
      const typeStore = { ...updates[type] }
      let hasUpdates = false

      typeDeltas.forEach((data, id) => {
        hasUpdates = true
        const existing = typeStore[id]

        if (existing) {
          typeStore[id] = {
            ...existing,
            upload: existing.upload + data.upload,
            download: existing.download + data.download,
            total:
              existing.upload +
              data.upload +
              (existing.download + data.download),
            lastSeen: now,
          }
        } else {
          typeStore[id] = {
            type,
            label: id,
            upload: data.upload,
            download: data.download,
            total: data.upload + data.download,
            firstSeen: now,
            lastSeen: now,
          }
        }
      })

      if (hasUpdates) {
        updates[type] = typeStore
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
