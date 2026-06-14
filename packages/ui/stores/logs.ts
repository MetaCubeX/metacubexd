import type { Log, LogWithSeq } from '~/types'
import { defineStore } from 'pinia'

// Incoming logs are buffered and flushed on a short timer. At debug level the
// backend can emit many lines per second; flushing per line rebuilt the entire
// (up to 1000-row) array and triggered a reactive update each time. Batching
// collapses a burst into one array rebuild + one update.
const FLUSH_INTERVAL = 250

export const useLogsStore = defineStore('logs', () => {
  const configStore = useConfigStore()

  // shallowRef: `logs` is always replaced wholesale and each row is immutable
  // once created, so deep reactivity would only pay to proxy every row for no
  // gain.
  const logs = shallowRef<LogWithSeq[]>([])
  const paused = ref(false)
  let seq = 1

  let pending: LogWithSeq[] = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    flushTimer = null
    if (pending.length === 0) return
    // `pending` is oldest→newest; newest rows must end up first in the list.
    pending.reverse()
    logs.value = [...pending, ...logs.value].slice(0, configStore.logMaxRows)
    pending = []
  }

  const scheduleFlush = () => {
    if (flushTimer) return
    flushTimer = setTimeout(flush, FLUSH_INTERVAL)
  }

  const addLog = (log: Log) => {
    if (paused.value) return
    pending.push({ ...log, seq })
    seq++
    scheduleFlush()
  }

  const clearLogs = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    pending = []
    logs.value = []
    seq = 1
  }

  const togglePaused = () => {
    paused.value = !paused.value
  }

  return {
    logs,
    paused,
    addLog,
    clearLogs,
    togglePaused,
  }
})
