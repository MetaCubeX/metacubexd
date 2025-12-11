<script setup lang="ts">
import {
  IconArrowDown,
  IconArrowUp,
  IconClock,
  IconInfoCircle,
  IconTrash,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import { formatDateRange, formatDuration } from '~/utils'

const { t, locale } = useI18n()
const connectionsStore = useConnectionsStore()
const configStore = useConfigStore()

type SortField = 'ip' | 'duration' | 'total'
type SortOrder = 'asc' | 'desc'

const sortField = ref<SortField>('total')
const sortOrder = ref<SortOrder>('desc')
const showTable = useLocalStorage('showDataUsageTable', false)

const formatBytes = (bytes: number) => byteSize(bytes).toString()

function handleSort(field: SortField) {
  if (sortField.value === field) {
    // Toggle order if same field
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Set new field with default desc order
    sortField.value = field
    sortOrder.value = 'desc'
  }
}

const dataUsageEntries = computed(() => {
  const entries = Object.values(connectionsStore.dataUsageMap)
  const field = sortField.value
  const order = sortOrder.value

  return entries.sort((a, b) => {
    let comparison = 0

    switch (field) {
      case 'ip':
        comparison = a.sourceIP.localeCompare(b.sourceIP)
        break
      case 'duration': {
        const durationA = a.firstSeen ? a.lastSeen - a.firstSeen : 0
        const durationB = b.firstSeen ? b.lastSeen - b.firstSeen : 0
        comparison = durationA - durationB
        break
      }
      case 'total':
        comparison = a.total - b.total
        break
    }

    return order === 'asc' ? comparison : -comparison
  })
})

const totalStats = computed(() => {
  const entries = dataUsageEntries.value
  const totalUpload = entries.reduce((sum, entry) => sum + entry.upload, 0)
  const totalDownload = entries.reduce((sum, entry) => sum + entry.download, 0)

  // Calculate overall time range
  let earliestFirst = Number.MAX_SAFE_INTEGER
  let latestLast = 0

  entries.forEach((entry) => {
    if (entry.firstSeen && entry.firstSeen < earliestFirst) {
      earliestFirst = entry.firstSeen
    }
    if (entry.lastSeen && entry.lastSeen > latestLast) {
      latestLast = entry.lastSeen
    }
  })

  const hasTimeRange =
    earliestFirst !== Number.MAX_SAFE_INTEGER && latestLast > 0

  return {
    count: entries.length,
    upload: totalUpload,
    download: totalDownload,
    total: totalUpload + totalDownload,
    firstSeen: hasTimeRange ? earliestFirst : undefined,
    lastSeen: hasTimeRange ? latestLast : undefined,
  }
})

function handleClearAll() {
  if (confirm(t('confirmClearAll'))) {
    connectionsStore.clearDataUsage()
  }
}

function handleRemoveEntry(sourceIP: string) {
  connectionsStore.removeDataUsageEntry(sourceIP)
}
</script>

<template>
  <div class="rounded-box bg-base-300 p-4">
    <div class="mb-4 flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-bold text-base-content">
            {{ t('dataUsage') }}
          </h2>
          <div
            class="tooltip tooltip-top before:ml-4 before:max-w-xs before:rounded-lg before:p-2 before:text-xs before:content-[attr(data-tip)] md:tooltip-right md:before:ml-0 md:before:text-sm lg:before:text-base"
            :data-tip="t('dataUsageInfo')"
          >
            <button class="btn btn-circle text-info btn-ghost btn-xs">
              <IconInfoCircle :size="18" />
            </button>
          </div>
          <input
            v-model="showTable"
            type="checkbox"
            class="toggle toggle-primary"
          />
        </div>
        <button
          v-if="showTable"
          class="btn btn-sm btn-error"
          @click="handleClearAll"
        >
          <IconTrash :size="16" />
          <span class="hidden sm:inline">{{ t('clearAll') }}</span>
        </button>
      </div>

      <template v-if="showTable">
        <!-- Total Stats -->
        <div
          v-if="totalStats.count > 0"
          class="stats stats-vertical bg-base-200 shadow sm:stats-horizontal"
        >
          <div class="stat py-2">
            <div class="stat-title text-xs">
              {{ t('devices') }}
            </div>
            <div class="stat-value text-lg text-primary">
              {{ totalStats.count }}
            </div>
          </div>
          <div
            v-if="totalStats.firstSeen && totalStats.lastSeen"
            class="stat py-2"
          >
            <div class="stat-title text-xs">
              {{ t('timeRange') }}
            </div>
            <div
              class="stat-value text-sm"
              :title="
                formatDateRange(
                  totalStats.firstSeen,
                  totalStats.lastSeen,
                  locale,
                )
              "
            >
              <div class="flex items-center gap-1">
                <IconClock :size="16" />
                <span>{{
                  formatDuration(totalStats.firstSeen, totalStats.lastSeen)
                }}</span>
              </div>
            </div>
          </div>
          <div class="stat py-2">
            <div class="stat-title text-xs">
              {{ t('uploadTotal') }}
            </div>
            <div class="stat-value text-lg">
              {{ formatBytes(totalStats.upload) }}
            </div>
          </div>
          <div class="stat py-2">
            <div class="stat-title text-xs">
              {{ t('downloadTotal') }}
            </div>
            <div class="stat-value text-lg">
              {{ formatBytes(totalStats.download) }}
            </div>
          </div>
          <div class="stat py-2">
            <div class="stat-title text-xs">
              {{ t('grandTotal') }}
            </div>
            <div class="stat-value text-lg text-secondary">
              {{ formatBytes(totalStats.total) }}
            </div>
          </div>
        </div>

        <!-- Desktop Table View -->
        <div class="hidden overflow-x-auto rounded-md lg:block">
          <table class="table w-full table-zebra">
            <thead>
              <tr class="bg-base-200">
                <th class="text-base-content">
                  {{ t('macAddress') }}
                </th>
                <th class="text-base-content">
                  <button
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('ip')"
                  >
                    <span>{{ t('ipAddress') }}</span>
                    <IconArrowUp
                      v-if="sortField === 'ip' && sortOrder === 'asc'"
                      :size="14"
                    />
                    <IconArrowDown
                      v-else-if="sortField === 'ip' && sortOrder === 'desc'"
                      :size="14"
                    />
                  </button>
                </th>
                <th class="text-base-content">
                  <button
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('duration')"
                  >
                    <span>{{ t('duration') }}</span>
                    <IconArrowUp
                      v-if="sortField === 'duration' && sortOrder === 'asc'"
                      :size="14"
                    />
                    <IconArrowDown
                      v-else-if="
                        sortField === 'duration' && sortOrder === 'desc'
                      "
                      :size="14"
                    />
                  </button>
                </th>
                <th class="text-base-content">
                  {{ t('upload') }}
                </th>
                <th class="text-base-content">
                  {{ t('download') }}
                </th>
                <th class="text-base-content">
                  <button
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('total')"
                  >
                    <span>{{ t('total') }}</span>
                    <IconArrowUp
                      v-if="sortField === 'total' && sortOrder === 'asc'"
                      :size="14"
                    />
                    <IconArrowDown
                      v-else-if="sortField === 'total' && sortOrder === 'desc'"
                      :size="14"
                    />
                  </button>
                </th>
                <th class="text-base-content">
                  {{ t('actions') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="dataUsageEntries.length === 0">
                <td colspan="7" class="text-center text-base-content/70">
                  {{ t('noDataUsageYet') }}
                </td>
              </tr>
              <tr
                v-for="entry in dataUsageEntries"
                v-else
                :key="entry.sourceIP"
                class="hover"
              >
                <td class="text-base-content">
                  {{ entry.macAddress || t('na') }}
                </td>
                <td class="font-mono text-base-content">
                  {{ entry.sourceIP }}
                </td>
                <td
                  class="text-base-content"
                  :title="
                    entry.firstSeen
                      ? formatDateRange(
                          entry.firstSeen,
                          entry.lastSeen,
                          locale,
                        )
                      : '-'
                  "
                >
                  <div class="flex items-center gap-1">
                    <IconClock :size="14" class="text-base-content/60" />
                    <span class="text-sm">
                      {{
                        entry.firstSeen
                          ? formatDuration(entry.firstSeen, entry.lastSeen)
                          : '-'
                      }}
                    </span>
                  </div>
                </td>
                <td class="text-base-content">
                  {{ formatBytes(entry.upload) }}
                </td>
                <td class="text-base-content">
                  {{ formatBytes(entry.download) }}
                </td>
                <td class="font-bold text-primary">
                  {{ formatBytes(entry.total) }}
                </td>
                <td>
                  <button
                    class="btn text-error btn-ghost btn-xs hover:bg-error/20"
                    :title="t('remove')"
                    @click="handleRemoveEntry(entry.sourceIP)"
                  >
                    <IconTrash :size="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Card View -->
        <div class="flex flex-col gap-3 lg:hidden">
          <!-- Mobile Sort Buttons -->
          <div
            v-if="dataUsageEntries.length > 0"
            class="flex gap-2 rounded-lg bg-base-200 p-3"
          >
            <div class="text-xs font-semibold text-base-content/60">
              {{ t('sortBy') }}
            </div>
            <div class="flex flex-1 gap-2">
              <button
                class="btn flex-1 btn-xs"
                :class="sortField === 'ip' ? 'btn-primary' : 'btn-ghost'"
                @click="handleSort('ip')"
              >
                {{ t('ipShort') }}
                <IconArrowUp
                  v-if="sortField === 'ip' && sortOrder === 'asc'"
                  :size="12"
                />
                <IconArrowDown
                  v-else-if="sortField === 'ip' && sortOrder === 'desc'"
                  :size="12"
                />
              </button>
              <button
                class="btn flex-1 btn-xs"
                :class="sortField === 'duration' ? 'btn-primary' : 'btn-ghost'"
                @click="handleSort('duration')"
              >
                {{ t('duration') }}
                <IconArrowUp
                  v-if="sortField === 'duration' && sortOrder === 'asc'"
                  :size="12"
                />
                <IconArrowDown
                  v-else-if="sortField === 'duration' && sortOrder === 'desc'"
                  :size="12"
                />
              </button>
              <button
                class="btn flex-1 btn-xs"
                :class="sortField === 'total' ? 'btn-primary' : 'btn-ghost'"
                @click="handleSort('total')"
              >
                {{ t('total') }}
                <IconArrowUp
                  v-if="sortField === 'total' && sortOrder === 'asc'"
                  :size="12"
                />
                <IconArrowDown
                  v-else-if="sortField === 'total' && sortOrder === 'desc'"
                  :size="12"
                />
              </button>
            </div>
          </div>

          <!-- No data -->
          <div
            v-if="dataUsageEntries.length === 0"
            class="rounded-lg bg-base-200 p-4 text-center text-base-content/70"
          >
            {{ t('noDataUsageYet') }}
          </div>

          <!-- Mobile Cards -->
          <div
            v-for="entry in dataUsageEntries"
            :key="entry.sourceIP"
            class="card bg-base-200 shadow-md"
          >
            <div class="card-body p-4">
              <div class="mb-2 flex items-start justify-between">
                <div class="flex-1">
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('ipAddress') }}
                  </div>
                  <div class="font-mono text-sm font-bold text-base-content">
                    {{ entry.sourceIP }}
                  </div>
                </div>
                <button
                  class="btn btn-circle text-error btn-ghost btn-xs"
                  :title="t('remove')"
                  @click="handleRemoveEntry(entry.sourceIP)"
                >
                  <IconTrash :size="16" />
                </button>
              </div>

              <div v-if="entry.macAddress" class="mb-2">
                <div
                  class="text-xs font-semibold text-base-content/60 uppercase"
                >
                  {{ t('macAddress') }}
                </div>
                <div class="text-sm text-base-content">
                  {{ entry.macAddress }}
                </div>
              </div>

              <div v-if="entry.firstSeen" class="mb-2">
                <div
                  class="text-xs font-semibold text-base-content/60 uppercase"
                >
                  {{ t('timeRange') }}
                </div>
                <div class="flex items-center gap-1 text-sm text-base-content">
                  <IconClock :size="14" class="text-base-content/60" />
                  <span>{{
                    formatDuration(entry.firstSeen, entry.lastSeen)
                  }}</span>
                </div>
                <div class="text-xs text-base-content/60">
                  {{
                    formatDateRange(
                      entry.firstSeen,
                      entry.lastSeen,
                      locale,
                    )
                  }}
                </div>
              </div>

              <div class="divider my-2" />

              <div class="grid grid-cols-3 gap-2">
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('upload') }}
                  </div>
                  <div class="text-sm font-medium text-base-content">
                    {{ formatBytes(entry.upload) }}
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('download') }}
                  </div>
                  <div class="text-sm font-medium text-base-content">
                    {{ formatBytes(entry.download) }}
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('total') }}
                  </div>
                  <div class="text-sm font-bold text-primary">
                    {{ formatBytes(entry.total) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
