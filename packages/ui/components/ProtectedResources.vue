<script setup lang="ts">
const { connect, disconnect, reconnectLogs } = useBackendWebSocket()
const configStore = useConfigStore()
const { hasFeature, ready } = useControlInfo()
const kernelStore = useKernelStore()

// Whether we should currently hold the backend WebSockets open.
// - Web dashboard (no kernel-control feature): always, as before.
// - Desktop: only while the managed kernel is running, since its Clash API port
//   is closed otherwise. Gate on `ready` so we don't connect before the
//   /api/control/info probe tells us which mode we're in.
const shouldConnect = computed(() => {
  if (!ready.value) return false
  if (!hasFeature('kernel-control')) return true
  return kernelStore.state?.status === 'running'
})

// Once the probe resolves in desktop kernel-control mode, seed the kernel status
// so `shouldConnect` reflects reality (the watcher then drives connect/disconnect
// on every subsequent start/stop).
watch(
  () => ready.value && hasFeature('kernel-control'),
  (isDesktopKernel) => {
    if (isDesktopKernel) {
      kernelStore
        .fetchStatus()
        .catch((err) =>
          console.error(
            '[protected-resources] initial kernel status failed',
            err,
          ),
        )
    }
  },
  { immediate: true },
)

watch(
  shouldConnect,
  (ok) => {
    if (ok) connect()
    else disconnect()
  },
  { immediate: true },
)

// Disconnect on unmount
onUnmounted(() => {
  disconnect()
})

// Reconnect logs WebSocket when log level changes (a no-op while the kernel is
// down — createLogsWebSocket() applies the same kernel gate).
watch(
  () => configStore.logLevel,
  () => {
    reconnectLogs()
  },
)
</script>

<template>
  <!-- This component manages WebSocket connections -->
  <div class="hidden" />
</template>
