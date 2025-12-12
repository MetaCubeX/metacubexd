<script setup lang="ts">
import { IconActivity, IconRefresh } from '@tabler/icons-vue'
import { useLatencyTest } from '~/composables/useLatencyTest'

const { t } = useI18n()

const { allResults, isTestingAll, testAllLatencies, averageLatency } =
  useLatencyTest()

// Test latencies on mount
onMounted(() => {
  testAllLatencies()
})

function getLatencyColor(latency: number | null | undefined) {
  if (latency === null || latency === undefined) return 'badge-ghost'
  if (latency < 100) return 'badge-success'
  if (latency < 300) return 'badge-warning'

  return 'badge-error'
}

function getLatencyBarWidth(latency: number | null | undefined) {
  if (latency === null || latency === undefined) return '0%'
  // Max width at 500ms
  const percentage = Math.min((latency / 500) * 100, 100)

  return `${percentage}%`
}

function getLatencyBarColor(latency: number | null | undefined) {
  if (latency === null || latency === undefined) return 'bg-base-300'
  if (latency < 100) return 'bg-success'
  if (latency < 300) return 'bg-warning'

  return 'bg-error'
}
</script>

<template>
  <div class="card bg-base-200 p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <IconActivity class="h-5 w-5 text-primary" />
        <h3 class="font-semibold">{{ t('networkLatency') }}</h3>
      </div>
      <div class="flex items-center gap-2">
        <span
          v-if="averageLatency !== null"
          class="badge"
          :class="getLatencyColor(averageLatency)"
        >
          {{ t('average') }}: {{ averageLatency }}ms
        </span>
        <button
          class="btn btn-circle btn-ghost btn-sm"
          :class="{ 'animate-spin': isTestingAll }"
          :disabled="isTestingAll"
          @click="testAllLatencies"
        >
          <IconRefresh class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <div
        v-for="item in allResults"
        :key="item.url"
        class="flex items-center gap-3"
      >
        <span class="w-20 shrink-0 truncate text-sm">{{ item.name }}</span>
        <div
          class="relative h-4 flex-1 overflow-hidden rounded-full bg-base-300"
        >
          <div
            class="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            :class="getLatencyBarColor(item.result?.latency)"
            :style="{ width: getLatencyBarWidth(item.result?.latency) }"
          ></div>
        </div>
        <span class="w-16 shrink-0 text-right font-mono text-sm">
          <span
            v-if="item.result?.status === 'pending'"
            class="loading loading-xs loading-spinner"
          ></span>
          <span v-else-if="item.result?.status === 'success'">
            {{ item.result.latency }}ms
          </span>
          <span v-else-if="item.result?.status === 'error'" class="text-error">
            {{ t('timeout') }}
          </span>
          <span v-else class="text-base-content/40">-</span>
        </span>
      </div>
    </div>
  </div>
</template>
