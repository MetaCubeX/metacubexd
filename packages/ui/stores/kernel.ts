// packages/ui/stores/kernel.ts
import type { KernelState } from '~/types/control'
import { defineStore } from 'pinia'
import { useControlApi } from '~/composables/useControlApi'

export interface KernelLogLine {
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

const LOG_CAP = 1000

export const useKernelStore = defineStore('kernel', () => {
  const state = ref<KernelState | null>(null)
  const logs = ref<KernelLogLine[]>([])
  const connected = ref(false)
  let es: EventSource | null = null

  const fetchStatus = async () => {
    state.value = await useControlApi().getKernelStatus()
  }
  const start = async () => {
    state.value = await useControlApi().startKernel()
  }
  const stop = async () => {
    state.value = await useControlApi().stopKernel()
  }
  const restart = async () => {
    state.value = await useControlApi().restartKernel()
  }
  // Recovery escape hatches for a config that bricks the kernel (#2109). Rollback
  // restores the last-known-good .bak; recover resets to a minimal config. Both
  // restart the kernel and echo the resulting state.
  const rollback = async () => {
    state.value = await useControlApi().rollbackKernel()
  }
  const recover = async () => {
    state.value = await useControlApi().recoverKernel()
  }

  const pushLog = (l: KernelLogLine) => {
    logs.value.push(l)
    if (logs.value.length > LOG_CAP) {
      logs.value.splice(0, logs.value.length - LOG_CAP)
    }
  }

  const connectLogs = () => {
    if (es) return
    es = new EventSource(useControlApi().logsUrl())
    connected.value = true
    es.onmessage = (ev) => {
      let frame: unknown
      try {
        frame = JSON.parse(ev.data)
      } catch {
        return // ignore malformed frames
      }
      const f = frame as
        | { type: 'log'; stream: 'stdout' | 'stderr'; line: string; ts: number }
        | ({ type: 'state' } & KernelState)
      if (f.type === 'log') {
        pushLog({ stream: f.stream, line: f.line, ts: f.ts })
      } else if (f.type === 'state') {
        // The 'state' frame is FLAT (KernelState spread at top level); strip the
        // discriminant before storing it as the KernelState (SHARED CONTRACTS).
        const { type: _t, ...s } = f
        state.value = s as KernelState
      }
    }
    es.onerror = () => {
      connected.value = false
    }
  }

  const disconnectLogs = () => {
    es?.close()
    es = null
    connected.value = false
  }

  const clearLogs = () => {
    logs.value = []
  }

  return {
    state,
    logs,
    connected,
    fetchStatus,
    start,
    stop,
    restart,
    rollback,
    recover,
    connectLogs,
    disconnectLogs,
    clearLogs,
  }
})
