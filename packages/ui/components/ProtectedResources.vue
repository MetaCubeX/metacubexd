<script setup lang="ts">
const { connect, disconnect, reconnectLogs } = useBackendWebSocket()
const configStore = useConfigStore()

// Connect WebSockets on mount
onMounted(() => {
  connect()
})

// Disconnect on unmount
onUnmounted(() => {
  disconnect()
})

// Reconnect logs WebSocket when log level changes
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
