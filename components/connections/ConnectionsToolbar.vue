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
  <div class="flex flex-col gap-2">
    <!-- Toolbar Row 1: Tabs + Quick filter + Source IP filter -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="tabs-box tabs gap-2 tabs-sm">
        <button
          v-for="tab in tabs"
          :key="tab.type"
          class="tab gap-2 px-2"
          :class="{ 'bg-primary text-neutral!': activeTab === tab.type }"
          @click="emit('update:activeTab', tab.type)"
        >
          <span>{{ tab.name }}</span>
          <div class="badge badge-sm">
            {{ tab.count }}
          </div>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <span class="hidden text-sm sm:inline-block">{{
          t('quickFilter')
        }}</span>
        <input
          type="checkbox"
          class="toggle toggle-sm"
          :checked="enableQuickFilter"
          @change="
            emit(
              'update:enableQuickFilter',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
      </div>

      <select
        class="select max-w-40 flex-1 select-sm select-primary"
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

    <!-- Toolbar Row 2: Sort + Search + Actions -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex shrink-0 items-center gap-1">
        <span class="hidden text-sm whitespace-nowrap sm:inline-block">
          {{ t('sortBy') }}
        </span>
        <select
          class="select select-sm select-primary"
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
        <Button class="btn btn-sm btn-primary" @click="emit('toggleSortOrder')">
          <IconSortDescending v-if="sortDesc" />
          <IconSortAscending v-else />
        </Button>
      </div>

      <div class="join flex min-w-0 flex-1 items-center">
        <input
          type="search"
          class="input input-sm join-item min-w-0 flex-1 input-primary"
          :placeholder="t('search')"
          :value="globalFilter"
          @input="
            emit(
              'update:globalFilter',
              ($event.target as HTMLInputElement).value,
            )
          "
        />

        <Button
          class="btn join-item btn-sm btn-primary"
          @click="emit('togglePaused')"
        >
          <IconPlayerPlay v-if="paused" />
          <IconPlayerPause v-else />
        </Button>

        <Button
          class="btn join-item btn-sm btn-primary"
          :loading="isClosingConnections"
          @click="emit('closeConnections')"
        >
          <IconX />
        </Button>

        <Button
          class="btn join-item btn-sm btn-primary"
          @click="emit('openSettings')"
        >
          <IconSettings />
        </Button>
      </div>
    </div>
  </div>
</template>
