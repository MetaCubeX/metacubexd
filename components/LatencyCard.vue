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

function getLatencyBadgeClass(latency: number | null | undefined) {
  if (latency === null || latency === undefined)
    return 'bg-base-content/10 text-base-content/50'
  if (latency < 100) return 'bg-success/15 text-success'
  if (latency < 300) return 'bg-warning/15 text-warning'

  return 'bg-error/15 text-error'
}

function getLatencyBarWidth(latency: number | null | undefined) {
  if (latency === null || latency === undefined) return '0%'
  // Max width at 500ms
  const percentage = Math.min((latency / 500) * 100, 100)

  return `${percentage}%`
}

function getLatencyBarClass(latency: number | null | undefined) {
  if (latency === null || latency === undefined) return 'bg-base-content/20'
  if (latency < 100) return 'bg-success'
  if (latency < 300) return 'bg-warning'

  return 'bg-error'
}
</script>

<template>
  <div
    class="rounded-xl border border-base-content/10 p-4"
    style="
      background: color-mix(in oklch, var(--color-base-200) 60%, transparent);
    "
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <IconActivity class="h-5 w-5 text-primary" />
        <h3 class="m-0 text-base font-semibold text-base-content">
          {{ t('networkLatency') }}
        </h3>
      </div>
      <div class="flex items-center gap-2">
        <span
          v-if="averageLatency !== null"
          class="rounded-md px-2 py-1 text-xs font-semibold"
          :class="getLatencyBadgeClass(averageLatency)"
        >
          {{ t('average') }}: {{ averageLatency }}ms
        </span>
        <button
          class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-base-content/60 transition-all duration-200 hover:bg-base-content/10 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-50"
          :class="{ 'animate-spin': isTestingAll }"
          :disabled="isTestingAll"
          @click="testAllLatencies"
        >
          <IconRefresh class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div
        v-for="item in allResults"
        :key="item.url"
        class="flex items-center gap-3"
      >
        <span
          class="w-20 shrink-0 overflow-hidden text-sm text-ellipsis whitespace-nowrap text-base-content"
        >
          {{ item.name }}
        </span>
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-base-content/10">
          <div
            class="h-full rounded-full transition-[width] duration-500 ease-out"
            :class="getLatencyBarClass(item.result?.latency)"
            :style="{ width: getLatencyBarWidth(item.result?.latency) }"
          />
        </div>
        <span
          class="w-16 shrink-0 text-right font-mono text-sm text-base-content"
        >
          <span
            v-if="item.result?.status === 'pending'"
            class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-base-content/20 border-t-primary"
          />
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
