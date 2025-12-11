import type { Log, LogWithSeq } from '~/types'
import { defineStore } from 'pinia'

export const useLogsStore = defineStore('logs', () => {
  const configStore = useConfigStore()

  // State
  const logs = ref<LogWithSeq[]>([])
  const paused = ref(false)
  let seq = 1

  // Actions
  const addLog = (log: Log) => {
    if (paused.value) return

    logs.value = [{ ...log, seq }, ...logs.value].slice(
      0,
      configStore.logMaxRows,
    )
    seq++
  }

  const clearLogs = () => {
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
