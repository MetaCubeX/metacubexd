import type { DataUsageType } from '~/types'
import { db } from '~/utils/db'

export interface AggregatedData {
  label: string
  upload: number
  download: number
  total: number
  count: number
}

export const useDataUsage = () => {
  const getAggregatedData = async (
    type: DataUsageType,
    startTime: number,
    endTime: number,
  ): Promise<AggregatedData[]> => {
    const logs = await db.query(startTime, endTime)
    const map = new Map<string, AggregatedData>()

    logs.forEach((log) => {
      let label = ''
      switch (type) {
        case 'sourceIP':
          label = log.sourceIP
          break
        case 'host':
          label = log.host
          break
        case 'outbound':
          label = log.outbound
          break
        case 'process':
          label = log.process
          break
        case 'inboundUser':
          label = log.inboundUser
          break
      }

      const existing = map.get(label)
      if (existing) {
        existing.upload += log.upload
        existing.download += log.download
        existing.total += log.upload + log.download
        existing.count += 1
      } else {
        map.set(label, {
          label,
          upload: log.upload,
          download: log.download,
          total: log.upload + log.download,
          count: 1,
        })
      }
    })

    return Array.from(map.values())
  }

  const getSubStatsByHost = async (
    dimension: Exclude<DataUsageType, 'host'>,
    label: string,
    startTime: number,
    endTime: number,
  ): Promise<AggregatedData[]> => {
    const logs = await db.query(startTime, endTime)
    const filteredLogs = logs.filter((log) => {
      switch (dimension) {
        case 'sourceIP':
          return log.sourceIP === label
        case 'outbound':
          return log.outbound === label
        case 'process':
          return log.process === label
        case 'inboundUser':
          return log.inboundUser === label
      }
      return false
    })

    const map = new Map<string, AggregatedData>()
    filteredLogs.forEach((log) => {
      const host = log.host
      const existing = map.get(host)
      if (existing) {
        existing.upload += log.upload
        existing.download += log.download
        existing.total += log.upload + log.download
        existing.count += 1
      } else {
        map.set(host, {
          label: host,
          upload: log.upload,
          download: log.download,
          total: log.upload + log.download,
          count: 1,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const getProxyStatsByHost = async (
    dimension: DataUsageType,
    parentLabel: string,
    host: string,
    startTime: number,
    endTime: number,
  ): Promise<AggregatedData[]> => {
    const logs = await db.query(startTime, endTime)
    const filteredLogs = logs.filter((log) => {
      if (log.host !== host) return false
      switch (dimension) {
        case 'sourceIP':
          return log.sourceIP === parentLabel
        case 'process':
          return log.process === parentLabel
        case 'outbound':
          return log.outbound === parentLabel
        case 'inboundUser':
          return log.inboundUser === parentLabel
      }
      return false
    })

    const map = new Map<string, AggregatedData>()
    filteredLogs.forEach((log) => {
      const proxy = log.outbound
      const existing = map.get(proxy)
      if (existing) {
        existing.upload += log.upload
        existing.download += log.download
        existing.total += log.upload + log.download
        existing.count += 1
      } else {
        map.set(proxy, {
          label: proxy,
          upload: log.upload,
          download: log.download,
          total: log.upload + log.download,
          count: 1,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const getDevicesByHost = async (
    host: string,
    startTime: number,
    endTime: number,
  ): Promise<AggregatedData[]> => {
    const logs = await db.query(startTime, endTime)
    const filteredLogs = logs.filter((log) => log.host === host)

    const map = new Map<string, AggregatedData>()
    filteredLogs.forEach((log) => {
      const label = log.sourceIP
      const existing = map.get(label)
      if (existing) {
        existing.upload += log.upload
        existing.download += log.download
        existing.total += log.upload + log.download
        existing.count += 1
      } else {
        map.set(label, {
          label,
          upload: log.upload,
          download: log.download,
          total: log.upload + log.download,
          count: 1,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const getDevicesByProxyAndHost = async (
    proxy: string,
    host: string,
    startTime: number,
    endTime: number,
  ): Promise<AggregatedData[]> => {
    const logs = await db.query(startTime, endTime)
    const filteredLogs = logs.filter(
      (log) => log.outbound === proxy && log.host === host,
    )

    const map = new Map<string, AggregatedData>()
    filteredLogs.forEach((log) => {
      const label = log.sourceIP
      const existing = map.get(label)
      if (existing) {
        existing.upload += log.upload
        existing.download += log.download
        existing.total += log.upload + log.download
        existing.count += 1
      } else {
        map.set(label, {
          label,
          upload: log.upload,
          download: log.download,
          total: log.upload + log.download,
          count: 1,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const getHostDetailStats = async (
    host: string,
    startTime: number,
    endTime: number,
  ): Promise<AggregatedData[]> => {
    const logs = await db.query(startTime, endTime)
    const filteredLogs = logs.filter((log) => log.host === host)

    const map = new Map<string, AggregatedData>()
    filteredLogs.forEach((log) => {
      const label = `${log.sourceIP} → ${log.outbound}`
      const existing = map.get(label)
      if (existing) {
        existing.upload += log.upload
        existing.download += log.download
        existing.total += log.upload + log.download
        existing.count += 1
      } else {
        map.set(label, {
          label,
          upload: log.upload,
          download: log.download,
          total: log.upload + log.download,
          count: 1,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const getTrafficTrend = async (
    startTime: number,
    endTime: number,
    bucketSizeMs: number,
  ): Promise<{ timestamp: number; upload: number; download: number }[]> => {
    const logs = await db.query(startTime, endTime)
    const buckets = new Map<number, { upload: number; download: number }>()

    for (let t = startTime; t <= endTime; t += bucketSizeMs) {
      const bucketStart = Math.floor(t / bucketSizeMs) * bucketSizeMs
      buckets.set(bucketStart, { upload: 0, download: 0 })
    }

    logs.forEach((log) => {
      const bucketStart =
        Math.floor(log.timestamp / bucketSizeMs) * bucketSizeMs
      if (buckets.has(bucketStart)) {
        const bucket = buckets.get(bucketStart)!
        bucket.upload += log.upload
        bucket.download += log.download
      }
    })

    return Array.from(buckets.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        ...data,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  return {
    getAggregatedData,
    getSubStatsByHost,
    getProxyStatsByHost,
    getDevicesByHost,
    getDevicesByProxyAndHost,
    getHostDetailStats,
    getTrafficTrend,
  }
}
