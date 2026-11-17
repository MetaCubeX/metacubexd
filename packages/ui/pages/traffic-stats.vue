<script setup lang="ts">
import type { HostTrafficResult, TrafficHostsResponse } from '~/types/traffic-stats'
import { IconArrowsSort, IconRefresh, IconSearch } from '@tabler/icons-vue'
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formatBytes } from '~/utils'

const { t } = useI18n()
const request = useRequest()

useHead({ title: computed(() => t('trafficStats')) })

const RANGE_PRESETS = [
  { key: '1h', label: 'lastHour', ms: 3600_000 },
  { key: '24h', label: 'lastDay', ms: 86400_000 },
  { key: '7d', label: 'lastWeek', ms: 7 * 86400_000 },
  { key: '30d', label: 'lastMonth', ms: 30 * 86400_000 },
] as const

type GroupFilter = 'all' | 'proxy' | 'direct'
type SortKey = 'host' | 'proxy' | 'direct' | 'total' | 'conns' | 'last'

const preset = ref<string>('24h')
const customStart = ref<string>('')
const customEnd = ref<string>('')
const domain = ref('')
const matchMode = ref<'suffix' | 'exact'>('suffix')
const groupFilter = ref<GroupFilter>('all')
const autoRefresh = ref(true)
const sortKey = ref<SortKey>('total')
const sortAsc = ref(false)

const loading = ref(false)
const errorText = ref('')
const disabled = ref(false)
const data = ref<TrafficHostsResponse | null>(null)

const now = ref(Date.now())
const rangeStart = computed(() => {
  if (preset.value === 'custom') {
    return customStart.value ? new Date(customStart.value).getTime() : now.value - 86400_000
  }
  const p = RANGE_PRESETS.find(r => r.key === preset.value)
  return now.value - (p?.ms ?? 86400_000)
})
const rangeEnd = computed(() => {
  if (preset.value === 'custom' && customEnd.value) {
    return new Date(customEnd.value).getTime()
  }
  return now.value
})

const rows = computed<HostTrafficResult[]>(() => {
  const list = [...(data.value?.hosts ?? [])]
  const weight = (r: HostTrafficResult) => {
    switch (sortKey.value) {
      case 'host': return 0
      case 'proxy': return r.proxy.up + r.proxy.down
      case 'direct': return r.direct.up + r.direct.down
      case 'conns': return r.conns
      case 'last': return r.last_seen
      default: return r.proxy.up + r.proxy.down + r.direct.up + r.direct.down
    }
  }
  list.sort((a, b) => {
    if (sortKey.value === 'host') {
      return sortAsc.value ? a.host.localeCompare(b.host) : b.host.localeCompare(a.host)
    }
    return sortAsc.value ? weight(a) - weight(b) : weight(b) - weight(a)
  })
  return list
})

const totals = computed(() => {
  const proxy = data.value?.totals?.proxy ?? { up: 0, down: 0 }
  const direct = data.value?.totals?.direct ?? { up: 0, down: 0 }
  return {
    proxy,
    direct,
    all: { up: proxy.up + direct.up, down: proxy.down + direct.down },
  }
})

async function load() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  try {
    const params = new URLSearchParams({
      since: String(Math.floor(rangeStart.value / 1000)),
      until: String(Math.floor(rangeEnd.value / 1000)),
      top: '500',
    })
    if (domain.value.trim()) {
      params.set('domain', domain.value.trim().toLowerCase())
      params.set('match', matchMode.value)
    }
    if (groupFilter.value !== 'all') params.set('group', groupFilter.value)

    data.value = await request.get(`traffic/hosts?${params.toString()}`).json<TrafficHostsResponse>()
    disabled.value = false
  }
  catch (error: any) {
    const status = error?.response?.status
    if (status === 404) {
      disabled.value = true
    }
    else {
      errorText.value = error?.message ?? String(error)
    }
  }
  finally {
    loading.value = false
  }
}

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
    return
  }
  sortKey.value = key
  sortAsc.value = key === 'host'
}

const timeFmt = (ts: number) => (ts ? dayjs.unix(ts).format('MM-DD HH:mm:ss') : '-')
const byteFmt = (n: number) => (n ? formatBytes(n) : '-')

let timer: ReturnType<typeof setInterval> | undefined
function startTimer() {
  stopTimer()
  if (autoRefresh.value) {
    timer = setInterval(() => {
      now.value = Date.now()
      load()
    }, 30_000)
  }
}
function stopTimer() {
  if (timer) clearInterval(timer)
  timer = undefined
}

watch([preset, groupFilter, matchMode], () => { now.value = Date.now(); load() })
watch([autoRefresh], startTimer)

onMounted(() => {
  load()
  startTimer()
})
onBeforeUnmount(stopTimer)
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-y-auto">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-1 rounded-xl border border-base-content/8 bg-base-200/60 p-1">
        <button
          v-for="p in RANGE_PRESETS"
          :key="p.key"
          class="rounded-lg px-3 py-1.5 text-sm transition-colors"
          :class="preset === p.key ? 'bg-primary text-primary-content' : 'text-base-content/70 hover:bg-base-content/5'"
          @click="preset = p.key"
        >
          {{ t(p.label) }}
        </button>
        <button
          class="rounded-lg px-3 py-1.5 text-sm transition-colors"
          :class="preset === 'custom' ? 'bg-primary text-primary-content' : 'text-base-content/70 hover:bg-base-content/5'"
          @click="preset = 'custom'"
        >
          {{ t('customRange') }}
        </button>
      </div>

      <div v-if="preset === 'custom'" class="flex items-center gap-2 text-sm">
        <input v-model="customStart" type="datetime-local" class="input input-sm input-bordered">
        <span class="opacity-60">~</span>
        <input v-model="customEnd" type="datetime-local" class="input input-sm input-bordered">
        <button class="btn btn-sm btn-primary" @click="now = Date.now(); load()">
          {{ t('apply') }}
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input v-model="autoRefresh" type="checkbox" class="toggle toggle-sm">
          {{ t('autoRefresh') }}
        </label>
        <button class="btn btn-sm btn-ghost gap-1" :disabled="loading" @click="now = Date.now(); load()">
          <IconRefresh class="size-4" :class="{ 'animate-spin': loading }" />
          {{ t('refresh') }}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <label class="input input-sm input-bordered flex items-center gap-2">
        <IconSearch class="size-4 opacity-60" />
        <input v-model="domain" :placeholder="t('domainFilter')" class="grow" @keydown.enter="load">
      </label>
      <select v-model="matchMode" class="select select-sm select-bordered">
        <option value="suffix">{{ t('matchSuffix') }}</option>
        <option value="exact">{{ t('matchExact') }}</option>
      </select>
      <div class="flex gap-1 rounded-xl border border-base-content/8 bg-base-200/60 p-1">
        <button
          v-for="g in (['all', 'proxy', 'direct'] as GroupFilter[])"
          :key="g"
          class="rounded-lg px-3 py-1 text-sm transition-colors"
          :class="groupFilter === g ? 'bg-primary text-primary-content' : 'text-base-content/70 hover:bg-base-content/5'"
          @click="groupFilter = g"
        >
          {{ g === 'all' ? t('all') : g === 'proxy' ? t('proxy') : t('direct') }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="card bg-base-200/60 p-3">
        <div class="text-xs opacity-60">{{ t('proxy') }} {{ t('upload') }}</div>
        <div class="text-lg font-semibold">{{ formatBytes(totals.proxy.up) }}</div>
      </div>
      <div class="card bg-base-200/60 p-3">
        <div class="text-xs opacity-60">{{ t('proxy') }} {{ t('download') }}</div>
        <div class="text-lg font-semibold">{{ formatBytes(totals.proxy.down) }}</div>
      </div>
      <div class="card bg-base-200/60 p-3">
        <div class="text-xs opacity-60">{{ t('direct') }} {{ t('upload') }}</div>
        <div class="text-lg font-semibold">{{ formatBytes(totals.direct.up) }}</div>
      </div>
      <div class="card bg-base-200/60 p-3">
        <div class="text-xs opacity-60">{{ t('direct') }} {{ t('download') }}</div>
        <div class="text-lg font-semibold">{{ formatBytes(totals.direct.down) }}</div>
      </div>
    </div>

    <div v-if="disabled" class="alert alert-warning text-sm">
      {{ t('statsDisabled') }}
    </div>
    <div v-else-if="errorText" class="alert alert-error text-sm">
      {{ errorText }}
      <button class="btn btn-xs" @click="load">{{ t('retry') }}</button>
    </div>

    <div class="flex-1 overflow-auto rounded-xl border border-base-content/8">
      <table class="table table-sm">
        <thead class="sticky top-0 bg-base-200">
          <tr>
            <th class="cursor-pointer" @click="setSort('host')">
              {{ t('host') }}
              <IconArrowsSort v-if="sortKey === 'host'" class="inline size-3" />
            </th>
            <th class="cursor-pointer text-right" @click="setSort('proxy')">
              {{ t('proxy') }} ↑/↓
              <IconArrowsSort v-if="sortKey === 'proxy'" class="inline size-3" />
            </th>
            <th class="cursor-pointer text-right" @click="setSort('direct')">
              {{ t('direct') }} ↑/↓
              <IconArrowsSort v-if="sortKey === 'direct'" class="inline size-3" />
            </th>
            <th class="cursor-pointer text-right" @click="setSort('total')">
              {{ t('total') }}
              <IconArrowsSort v-if="sortKey === 'total'" class="inline size-3" />
            </th>
            <th class="cursor-pointer text-right" @click="setSort('conns')">
              {{ t('conns') }}
              <IconArrowsSort v-if="sortKey === 'conns'" class="inline size-3" />
            </th>
            <th class="cursor-pointer text-right" @click="setSort('last')">
              {{ t('lastSeen') }}
              <IconArrowsSort v-if="sortKey === 'last'" class="inline size-3" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.host" class="hover">
            <td class="max-w-xs truncate">{{ row.host }}</td>
            <td class="text-right font-mono text-xs">
              {{ byteFmt(row.proxy.up) }} / {{ byteFmt(row.proxy.down) }}
            </td>
            <td class="text-right font-mono text-xs">
              {{ byteFmt(row.direct.up) }} / {{ byteFmt(row.direct.down) }}
            </td>
            <td class="text-right font-mono text-xs">
              {{ byteFmt(row.proxy.up + row.proxy.down + row.direct.up + row.direct.down) }}
            </td>
            <td class="text-right text-xs">{{ row.conns }}</td>
            <td class="text-right text-xs opacity-70">{{ timeFmt(row.last_seen) }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="6" class="py-10 text-center text-sm opacity-60">
              {{ loading ? t('loading') : t('noData') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
