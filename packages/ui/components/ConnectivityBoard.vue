<script setup lang="ts">
import type {ReachabilityTarget} from '~/composables/useReachabilityBoard';
import {
  IconActivity,
  IconBrandSpeedtest,
  IconCheck,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-vue'
import Button from '~/components/Button.vue'
import {
  CONNECTIVITY_TARGETS,
  
  STREAMING_UNLOCK_TARGETS,
  useReachabilityBoard
} from '~/composables/useReachabilityBoard'

const { t } = useI18n()
const proxiesStore = useProxiesStore()
const configStore = useConfigStore()

const { isRunning, results, testTargetsThroughNode } = useReachabilityBoard()

// Selectable nodes/groups: every group name plus every individual node name.
// The delay-test endpoint accepts either, since a group resolves to its current
// node and a node tests directly.
const selectableNames = computed(() => {
  const groupNames = proxiesStore.proxies.map((proxy) => proxy.name)
  const nodeNames = Object.keys(proxiesStore.proxyNodeMap)
  return Array.from(new Set([...groupNames, ...nodeNames]))
})

const selectedNode = ref('')

// Default to the first group/node once data is available.
watch(
  selectableNames,
  (names) => {
    if (!selectedNode.value && names.length > 0) {
      selectedNode.value = names[0] ?? ''
    }
  },
  { immediate: true },
)

type TargetGroupKey = 'connectivity' | 'streaming'

const targetGroups: Record<TargetGroupKey, ReachabilityTarget[]> = {
  connectivity: CONNECTIVITY_TARGETS,
  streaming: STREAMING_UNLOCK_TARGETS,
}

const activeGroup = ref<TargetGroupKey>('connectivity')

const groupTabs = computed(() => [
  {
    key: 'connectivity' as const,
    label: t('connectivityTargets'),
    count: CONNECTIVITY_TARGETS.length,
  },
  {
    key: 'streaming' as const,
    label: t('streamingUnlockTargets'),
    count: STREAMING_UNLOCK_TARGETS.length,
  },
])

const activeTargets = computed(() => targetGroups[activeGroup.value])

const runBoard = async () => {
  if (!selectedNode.value) return
  await testTargetsThroughNode(selectedNode.value, activeTargets.value, {
    timeout: configStore.latencyTestTimeoutDuration,
  })
}

// Whether a run has produced any results yet — drives the "pick a node" hint.
const hasRun = computed(() => Object.keys(results.value).length > 0)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Node selector + run -->
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex min-w-48 flex-1 flex-col gap-1">
        <label class="text-xs font-medium text-base-content/60">
          {{ t('reachabilityNode') }}
        </label>
        <select
          v-model="selectedNode"
          class="select-bordered select w-full"
          :disabled="isRunning"
        >
          <option v-if="selectableNames.length === 0" value="">
            {{ t('reachabilityNoNodes') }}
          </option>
          <option v-for="name in selectableNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </div>

      <Button
        class="flex h-10 items-center gap-2 rounded-[0.625rem] border border-primary/30 bg-primary/10 px-4 text-primary transition-all duration-200 hover:border-primary/40 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="isRunning || !selectedNode"
        @click="runBoard"
      >
        <IconBrandSpeedtest
          :size="18"
          :class="{ 'animate-pulse text-success': isRunning }"
        />
        <span class="text-sm font-medium">
          {{ isRunning ? t('testing') : t('reachabilityRunTest') }}
        </span>
      </Button>
    </div>

    <!-- Target group tabs -->
    <div
      class="flex w-fit gap-1 rounded-xl border border-base-content/8 bg-base-200/60 p-1"
    >
      <button
        v-for="tab in groupTabs"
        :key="tab.key"
        class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-base-content/70 transition-all duration-200 hover:bg-base-content/5"
        :class="{
          'bg-primary text-primary-content shadow-md shadow-primary/30 hover:bg-primary':
            activeGroup === tab.key,
        }"
        @click="activeGroup = tab.key"
      >
        <span class="font-medium">{{ tab.label }}</span>
        <span
          class="rounded-md bg-base-content/10 px-1.5 py-0.5 text-xs font-semibold"
          :class="{ 'bg-primary-content/20': activeGroup === tab.key }"
        >
          {{ tab.count }}
        </span>
      </button>
    </div>

    <!-- Limitation note (streaming/AI unlock) -->
    <div
      v-if="activeGroup === 'streaming'"
      class="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning"
    >
      <IconInfoCircle :size="16" class="mt-0.5 shrink-0" />
      <span>{{ t('reachabilityUnlockLimitation') }}</span>
    </div>

    <!-- Results grid -->
    <div
      class="grid grid-cols-1 gap-2 sm:grid-cols-2"
      role="list"
      :aria-label="t('reachabilityResults')"
    >
      <div
        v-for="target in activeTargets"
        :key="target.name"
        role="listitem"
        class="flex items-center justify-between gap-3 rounded-lg border border-base-content/8 bg-base-200/40 px-3 py-2"
      >
        <div class="flex min-w-0 items-center gap-2">
          <IconActivity :size="16" class="shrink-0 text-base-content/40" />
          <span class="truncate text-sm font-medium">{{ target.name }}</span>
        </div>

        <!-- Pending / not yet run -->
        <span v-if="!results[target.name]" class="text-xs text-base-content/40">
          {{ isRunning ? t('testing') : '—' }}
        </span>

        <!-- Reachable -->
        <span
          v-else-if="results[target.name]?.reachable"
          class="inline-flex items-center gap-1 rounded-md bg-success/12 px-2 py-0.5 text-xs font-semibold text-success"
        >
          <IconCheck :size="14" />
          {{ results[target.name]?.latency }} {{ t('ms') }}
        </span>

        <!-- Unreachable -->
        <span
          v-else
          class="inline-flex items-center gap-1 rounded-md bg-error/12 px-2 py-0.5 text-xs font-semibold text-error"
        >
          <IconX :size="14" />
          {{ t('reachabilityUnreachable') }}
        </span>
      </div>
    </div>

    <p v-if="!hasRun && !isRunning" class="text-xs text-base-content/45">
      {{ t('reachabilityHint') }}
    </p>
  </div>
</template>
