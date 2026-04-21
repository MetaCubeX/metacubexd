import type {
  Connection,
  ConnectionRawMessage,
  DataUsageType,
  WsMsg,
} from '~/types'
import type { DataUsageLog } from '~/utils/db'
import { isNumber } from 'lodash-es'
import { defineStore } from 'pinia'

import { CONNECTIONS_TABLE_MAX_CLOSED_ROWS } from '~/constants'
import { db } from '~/utils/db'

export const useConnectionsStore = defineStore('connections', () => {
  const globalStore = useGlobalStore()

  // State
  const allConnections = ref<Connection[]>([])
  const activeConnections = ref<Connection[]>([])
  const closedConnections = ref<Connection[]>([])
  const latestConnectionMsg = ref<WsMsg>(null)
  const paused = ref(false)

  // Data usage tracking (IndexedDB buffer)
  const logBuffer: DataUsageLog[] = []
  let flushTimeout: ReturnType<typeof setTimeout> | null = null

  const flushLogs = async () => {
    if (logBuffer.length === 0) return
    const logsToFlush = [...logBuffer]
    logBuffer.length = 0
    try {
      await db.addLogs(logsToFlush)
      // Periodic cleanup: delete logs older than 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      await db.cleanup(thirtyDaysAgo)
    } catch (e) {
      console.error('[Data Usage] Failed to flush logs to IndexedDB', e)
    }
  }

  const scheduleFlush = () => {
    if (flushTimeout) return
    flushTimeout = setTimeout(async () => {
      await flushLogs()
      flushTimeout = null
    }, 5000)
  }

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
        return {
          ...connection,
          downloadSpeed: 0,
          uploadSpeed: 0,
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

    // Add new active connections first (fresh data)
    for (const c of activeConns) {
      if (!seen.has(c.id)) {
        seen.add(c.id)
        merged.push(c)
      }
    }

    // Append previous connections not in the new active list
    for (const c of allConnections.value) {
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
  const clearDataUsage = async () => {
    logBuffer.length = 0
    await db.clearAll()
    connectionLastData.clear()
  }

  // Remove specific entry (Note: In IndexedDB model, "removing" an entry might mean deleting all logs for that label in a timeframe, but usually we just clear all or let it expire)
  const removeDataUsageEntry = async (_type: DataUsageType, _id: string) => {
    // This is harder with the log-based model. We might want to just skip this or implement a more complex deletion
    // For now, let's keep it as a placeholder or ignore since we are moving to a historical model
    console.warn(
      '[Data Usage] removeDataUsageEntry is not supported in the new log-based model',
    )
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
    if (!hasInitializedSession) {
      hasInitializedSession = true
    }

    const now = Date.now()
    let hasDeltas = false

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

      hasDeltas = true
      logBuffer.push({
        timestamp: now,
        sourceIP: conn.metadata.sourceIP || 'Inner',
        host: conn.metadata.host || conn.metadata.destinationIP,
        process: conn.metadata.process || 'Unknown',
        outbound: conn.chains[0] ?? 'DIRECT',
        upload: uploadDelta,
        download: downloadDelta,
      })
    })

    if (hasDeltas) {
      scheduleFlush()
    }
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
    speedGroupByName,
    updateFromWsMsg,
    clearDataUsage,
    removeDataUsageEntry,
    restructRawMsgToConnection,
  }
})
