<script setup lang="ts">
import type { ConnectionColumn } from './ConnectionsTable.vue'
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-vue'

defineProps<{
  tabs: Array<{
    type: 'active' | 'closed'
    name: string
    count: number
  }>
  activeTab: 'active' | 'closed'
  enableQuickFilter: boolean
  sourceIPFilter: string
  uniqueSourceIPs: string[]
  sortColumn: string
  sortDesc: boolean
  sortableColumns: ConnectionColumn[]
  globalFilter: string
  paused: boolean
  isClosingConnections: boolean
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: 'active' | 'closed']
  'update:enableQuickFilter': [enabled: boolean]
  'update:sourceIPFilter': [ip: string]
  'update:sortColumn': [column: string]
  'update:globalFilter': [filter: string]
  toggleSortOrder: []
  togglePaused: []
  closeConnections: []
  openSettings: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Toolbar Row 1: Tabs + Quick filter + Source IP filter -->
    <div class="flex flex-wrap items-center gap-2">
      <div
        class="flex gap-1 rounded-lg border border-base-content/12 bg-base-200/60 p-1"
      >
        <button
          v-for="tab in tabs"
          :key="tab.type"
          class="flex cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-3 py-1.5 text-[0.8125rem] font-medium text-base-content/60 transition-all duration-200 hover:bg-base-content/5 hover:text-base-content"
          :class="{
            'bg-primary! text-primary-content! shadow-[0_2px_8px_var(--color-primary)/30]':
              activeTab === tab.type,
          }"
          @click="emit('update:activeTab', tab.type)"
        >
          <span>{{ tab.name }}</span>
          <span
            class="inline-flex h-[1.125rem] min-w-5 items-center justify-center rounded-full bg-current/20 px-1.5 text-[0.6875rem] font-semibold"
          >
            {{ tab.count }}
          </span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <span
          class="hidden text-[0.8125rem] text-base-content/60 sm:inline-block"
        >
          {{ t('quickFilter') }}
        </span>
        <label class="relative inline-block h-5 w-9 cursor-pointer">
          <input
            type="checkbox"
            class="peer h-0 w-0 opacity-0"
            :checked="enableQuickFilter"
            @change="
              emit(
                'update:enableQuickFilter',
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          <span
            class="absolute inset-0 rounded-full bg-base-content/20 transition-all duration-200 peer-checked:bg-primary before:absolute before:top-1/2 before:left-0.5 before:h-3.5 before:w-3.5 before:-translate-y-1/2 before:rounded-full before:bg-base-100 before:shadow-sm before:transition-all before:duration-200 before:content-[''] peer-checked:before:left-[calc(100%-2px)] peer-checked:before:-translate-x-full"
          />
        </label>
      </div>

      <div class="max-w-40 flex-1">
        <select
          class="w-full cursor-pointer appearance-none rounded-lg border border-base-content/12 bg-base-200/60 bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat py-1.5 pr-7 pl-3 text-[0.8125rem] text-base-content transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_2px_var(--color-primary)/20] focus:outline-none"
          style="
            background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;);
          "
          :value="sourceIPFilter"
          @change="
            emit(
              'update:sourceIPFilter',
              ($event.target as HTMLSelectElement).value,
            )
          "
        >
          <option value="">
            {{ t('all') }}
          </option>
          <option v-for="ip in uniqueSourceIPs" :key="ip" :value="ip">
            {{ ip }}
          </option>
        </select>
      </div>
    </div>

    <!-- Toolbar Row 2: Sort + Search + Actions -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex shrink-0 items-center gap-1.5">
        <span
          class="hidden text-[0.8125rem] whitespace-nowrap text-base-content/60 sm:inline-block"
        >
          {{ t('sortBy') }}
        </span>
        <select
          class="w-full max-w-32 cursor-pointer appearance-none rounded-lg border border-base-content/12 bg-base-200/60 bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat py-1.5 pr-7 pl-3 text-[0.8125rem] text-base-content transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_2px_var(--color-primary)/20] focus:outline-none"
          style="
            background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;);
          "
          :value="sortColumn"
          @change="
            emit(
              'update:sortColumn',
              ($event.target as HTMLSelectElement).value,
            )
          "
        >
          <option
            v-for="col in sortableColumns"
            :key="col.id"
            :value="col.sortId"
          >
            {{ t(col.key) }}
          </option>
        </select>
        <button
          class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-base-content/12 bg-base-200/60 text-base-content transition-all duration-200 hover:border-base-content/20 hover:bg-base-300"
          @click="emit('toggleSortOrder')"
        >
          <IconSortDescending v-if="sortDesc" :size="18" />
          <IconSortAscending v-else :size="18" />
        </button>
      </div>

      <div class="flex min-w-0 flex-1 items-center gap-1">
        <input
          type="search"
          class="min-w-0 flex-1 rounded-lg border border-base-content/12 bg-base-200/60 px-3 py-2 text-[0.8125rem] text-base-content transition-all duration-200 placeholder:text-base-content/40 focus:border-primary focus:bg-base-100 focus:shadow-[0_0_0_2px_var(--color-primary)/20] focus:outline-none"
          :placeholder="t('search')"
          :value="globalFilter"
          @input="
            emit(
              'update:globalFilter',
              ($event.target as HTMLInputElement).value,
            )
          "
        />

        <button
          class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-base-content/12 bg-base-200/60 text-base-content transition-all duration-200 hover:border-base-content/20 hover:bg-base-300"
          :class="{
            'border-warning/30 bg-warning/15 text-warning hover:bg-warning/25':
              paused,
          }"
          @click="emit('togglePaused')"
        >
          <IconPlayerPlay v-if="paused" :size="18" />
          <IconPlayerPause v-else :size="18" />
        </button>

        <button
          class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-base-content/12 bg-base-200/60 text-base-content transition-all duration-200 hover:border-error/30 hover:bg-error/15 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isClosingConnections"
          @click="emit('closeConnections')"
        >
          <span
            v-if="isClosingConnections"
            class="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
          />
          <IconX v-else :size="18" />
        </button>

        <button
          class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-base-content/12 bg-base-200/60 text-base-content transition-all duration-200 hover:border-base-content/20 hover:bg-base-300"
          @click="emit('openSettings')"
        >
          <IconSettings :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>
