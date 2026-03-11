<script setup lang="ts">
import type { AggregatedData } from '~/composables/useDataUsage'
import type { DataUsageType } from '~/types'
import {
  IconChevronDown,
  IconChevronRight,
  IconLink,
  IconListDetails,
  IconSearch,
  IconSelector,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-vue'
import { formatBytes } from '~/utils'

const props = defineProps<{
  selectedRow: string
  activeView: DataUsageType
  subStats: AggregatedData[]
  proxyStatsMap: Record<string, AggregatedData[]>
  selectedSubRow: string | null
}>()

const emit = defineEmits<{
  (e: 'subRowClick', parentLabel: string, subLabel: string): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()

const tableSizeClass = computed(() =>
  configStore.tableSizeClassName(configStore.connectionsTableSize),
)

// Sub Pagination Logic
const subSearchQuery = ref('')
const subCurrentPage = ref(0)
const subPageSize = useLocalStorage('traffic_sub_page_size', 50)

// Sort Logic
type SubSortField = 'label' | 'upload' | 'download' | 'total'
const subSortField = ref<SubSortField>('total')
const subSortOrder = ref<'asc' | 'desc'>('desc')

const handleSort = (field: SubSortField) => {
  if (subSortField.value === field) {
    subSortOrder.value = subSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    subSortField.value = field
    subSortOrder.value = 'desc'
  }
}

const filteredSubStats = computed(() => {
  const stats = [...(props.subStats || [])]

  // Filter
  let filtered = stats
  if (subSearchQuery.value) {
    const q = subSearchQuery.value.toLowerCase()
    filtered = stats.filter((s) => s.label.toLowerCase().includes(q))
  }

  // Sort
  return filtered.sort((a, b) => {
    let comparison = 0
    if (subSortField.value === 'label') {
      comparison = a.label.localeCompare(b.label)
    } else {
      comparison =
        (a[subSortField.value] as number) - (b[subSortField.value] as number)
    }
    return subSortOrder.value === 'asc' ? comparison : -comparison
  })
})

const totalSubPages = computed(() =>
  Math.max(1, Math.ceil(filteredSubStats.value.length / subPageSize.value)),
)

const getVisiblePages = (current: number, total: number) => {
  const pages: number[] = []
  pages.push(0)
  for (
    let i = Math.max(1, current - 1);
    i <= Math.min(total - 2, current + 1);
    i++
  ) {
    if (!pages.includes(i)) pages.push(i)
  }
  if (total > 1 && !pages.includes(total - 1)) {
    pages.push(total - 1)
  }
  return pages.sort((a, b) => a - b)
}

const visibleSubPages = computed(() =>
  getVisiblePages(subCurrentPage.value, totalSubPages.value),
)

const paginatedSubEntries = computed(() => {
  const start = subCurrentPage.value * subPageSize.value
  return filteredSubStats.value.slice(start, start + subPageSize.value)
})

const subPaginationInfo = computed(() => {
  const total = filteredSubStats.value.length
  const start = subCurrentPage.value * subPageSize.value + 1
  const end = Math.min((subCurrentPage.value + 1) * subPageSize.value, total)
  return total > 0 ? `${start}-${end} / ${total}` : `0 / 0`
})

watch(
  () => props.selectedRow,
  () => {
    subCurrentPage.value = 0
  },
)
</script>

<template>
  <div
    class="relative flex h-[600px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-200/50 shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-primary)_20%,transparent),0_4px_24px_-4px_color-mix(in_oklch,var(--color-primary)_10%,transparent)] backdrop-blur-[4px] transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-primary)_30%,transparent),0_8px_32px_-4px_color-mix(in_oklch,var(--color-primary)_10%,transparent)]"
  >
    <!-- Card Header -->
    <div
      class="flex items-center gap-3 border-b border-[color-mix(in_oklch,var(--color-base-content)_5%,transparent)] bg-base-300/30 px-4 py-3"
    >
      <IconListDetails :size="20" class="text-primary" />
      <h3 class="font-semibold tracking-tight text-base-content">
        {{ t('dataUsage') }}{{ t('details') }}
      </h3>

      <div class="flex-1" />

      <!-- Search integrated into header -->
      <div class="relative hidden w-64 sm:block">
        <IconSearch
          :size="14"
          class="absolute top-1/2 left-3 -translate-y-1/2 text-base-content/40"
        />
        <input
          v-model="subSearchQuery"
          type="search"
          :placeholder="t('search')"
          class="w-full rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_12%,transparent)] bg-base-200/60 py-1.5 pr-3 pl-9 text-[0.8125rem] text-base-content transition-all duration-200 placeholder:text-base-content/40 focus:border-primary focus:bg-base-100 focus:outline-none"
        />
      </div>
    </div>

    <!-- Table Container -->
    <div class="min-h-0 flex-1 overflow-auto">
      <table class="table w-full border-collapse" :class="tableSizeClass">
        <thead class="hidden md:table-header-group">
          <tr class="sticky top-0 z-10 bg-base-200">
            <th
              class="cursor-pointer border-b border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-base-content/70 uppercase transition-colors hover:bg-base-content/5"
              @click="handleSort('label')"
            >
              <div class="flex items-center gap-1">
                <span>{{
                  activeView === 'host' ? t('devices') : t('host')
                }}</span>
                <component
                  :is="
                    subSortField === 'label'
                      ? subSortOrder === 'asc'
                        ? IconSortAscending
                        : IconSortDescending
                      : IconSelector
                  "
                  :size="14"
                  :class="
                    subSortField === 'label' ? 'text-primary' : 'opacity-30'
                  "
                />
              </div>
            </th>
            <th
              class="hidden cursor-pointer border-b border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-base-content/70 uppercase transition-colors hover:bg-base-content/5 lg:table-cell"
              @click="handleSort('upload')"
            >
              <div class="flex items-center gap-1">
                <span>{{ t('upload') }}</span>
                <component
                  :is="
                    subSortField === 'upload'
                      ? subSortOrder === 'asc'
                        ? IconSortAscending
                        : IconSortDescending
                      : IconSelector
                  "
                  :size="14"
                  :class="
                    subSortField === 'upload' ? 'text-primary' : 'opacity-30'
                  "
                />
              </div>
            </th>
            <th
              class="hidden cursor-pointer border-b border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-base-content/70 uppercase transition-colors hover:bg-base-content/5 lg:table-cell"
              @click="handleSort('download')"
            >
              <div class="flex items-center gap-1">
                <span>{{ t('download') }}</span>
                <component
                  :is="
                    subSortField === 'download'
                      ? subSortOrder === 'asc'
                        ? IconSortAscending
                        : IconSortDescending
                      : IconSelector
                  "
                  :size="14"
                  :class="
                    subSortField === 'download' ? 'text-primary' : 'opacity-30'
                  "
                />
              </div>
            </th>
            <th
              class="cursor-pointer border-b border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] px-4 py-3 text-right text-xs font-semibold tracking-wide whitespace-nowrap text-base-content/70 uppercase transition-colors hover:bg-base-content/5 md:text-left"
              @click="handleSort('total')"
            >
              <div class="flex items-center justify-end gap-1 md:justify-start">
                <span>{{ t('total') }}</span>
                <component
                  :is="
                    subSortField === 'total'
                      ? subSortOrder === 'asc'
                        ? IconSortAscending
                        : IconSortDescending
                      : IconSelector
                  "
                  :size="14"
                  :class="
                    subSortField === 'total' ? 'text-primary' : 'opacity-30'
                  "
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="(sub, index) in paginatedSubEntries"
            :key="sub.label"
          >
            <tr
              class="animate-in fade-in slide-in-from-bottom-1 m-1 flex cursor-pointer flex-wrap rounded-lg bg-base-100 p-2 transition-all duration-200 hover:bg-base-content/5 hover:shadow-[0_2px_8px_rgba(var(--color-base-content),0.08)] md:m-0 md:table-row md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:even:bg-base-content/5 md:hover:bg-base-content/10 md:hover:shadow-none"
              :class="{
                'bg-primary/10! md:bg-primary/10!':
                  selectedSubRow === `${selectedRow}:${sub.label}`,
              }"
              :style="{ animationDelay: `${(index % 20) * 15}ms` }"
              @click="emit('subRowClick', selectedRow, sub.label)"
            >
              <td class="flex-1 md:table-cell">
                <div class="flex flex-col gap-0.5 py-1">
                  <div class="flex items-center gap-2 font-mono text-xs">
                    <div class="shrink-0 opacity-30">
                      <IconChevronDown
                        v-if="selectedSubRow === `${selectedRow}:${sub.label}`"
                        :size="14"
                      />
                      <IconChevronRight v-else :size="14" />
                    </div>
                    <span class="truncate">{{ sub.label }}</span>
                  </div>

                  <!-- Mobile-only compact stats -->
                  <div
                    class="flex items-center gap-3 pl-5 text-[10px] font-bold opacity-50 lg:hidden"
                  >
                    <div class="flex items-center gap-0.5">
                      <span class="opacity-50">↑</span>
                      <span>{{ formatBytes(sub.upload) }}</span>
                    </div>
                    <div class="flex items-center gap-0.5">
                      <span class="opacity-50">↓</span>
                      <span>{{ formatBytes(sub.download) }}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="hidden lg:table-cell">
                {{ formatBytes(sub.upload) }}
              </td>
              <td class="hidden lg:table-cell">
                <span class="font-mono text-xs opacity-70">
                  {{ formatBytes(sub.download) }}
                </span>
              </td>
              <td class="text-right md:table-cell md:text-left">
                <span class="text-xs font-black text-primary">
                  {{ formatBytes(sub.total) }}
                </span>
              </td>
            </tr>

            <!-- 3rd Level Breakdown -->
            <tr
              v-if="selectedSubRow === `${selectedRow}:${sub.label}`"
              class="animate-in fade-in slide-in-from-top-1 block w-full md:table-row"
            >
              <td
                colspan="4"
                class="block w-full px-2 py-1 md:table-cell md:p-4"
              >
                <div
                  class="grid w-full grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
                >
                  <div
                    v-for="item in proxyStatsMap[`${selectedRow}:${sub.label}`]"
                    :key="item.label"
                    class="flex h-full flex-col justify-between gap-1 rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-300/30 p-2 shadow-sm transition-all hover:border-primary/30 sm:rounded-xl sm:p-3"
                  >
                    <span
                      class="mb-1 truncate border-b border-base-content/5 pb-1 font-mono text-[9px] font-bold text-secondary sm:text-[10px]"
                      :title="item.label"
                      >{{ item.label }}</span
                    >
                    <div
                      class="flex flex-col gap-1 text-[9px] font-bold sm:text-[10px]"
                    >
                      <div
                        class="flex items-center justify-between border-b border-base-content/5 pb-1"
                      >
                        <div class="flex items-center gap-1 opacity-50">
                          <IconLink :size="10" />
                          <span>{{ item.count }}</span>
                        </div>
                        <span class="font-black text-primary">{{
                          formatBytes(item.total)
                        }}</span>
                      </div>

                      <div
                        class="flex flex-wrap items-center justify-between gap-x-1 opacity-60"
                      >
                        <span class="whitespace-nowrap"
                          >↑ {{ formatBytes(item.upload) }}</span
                        >
                        <span class="whitespace-nowrap"
                          >↓ {{ formatBytes(item.download) }}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div
        v-if="!paginatedSubEntries.length"
        class="flex items-center justify-center px-4 py-12 text-sm text-base-content/50 italic"
      >
        <span>{{ t('noDetailedData') }}</span>
      </div>
    </div>

    <!-- Footer Pagination -->
    <div
      class="flex shrink-0 items-center justify-between gap-4 border-t border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-200/60 p-3"
    >
      <div class="flex items-center gap-3">
        <select
          v-model.number="subPageSize"
          class="cursor-pointer rounded-md border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-100 px-2.5 py-1.5 text-[0.8125rem] text-base-content transition-colors duration-200 focus:border-primary focus:outline-none"
        >
          <option v-for="size in [20, 50, 100, 200]" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
        <span
          class="text-xs font-bold tracking-wider whitespace-nowrap text-base-content/60 uppercase"
          >{{ subPaginationInfo }}</span
        >
      </div>
      <ConnectionsPagination
        :current-page="subCurrentPage"
        :total-pages="totalSubPages"
        :visible-pages="visibleSubPages"
        @go-to-page="subCurrentPage = $event"
        @previous="subCurrentPage--"
        @next="subCurrentPage++"
      />
    </div>
  </div>
</template>
