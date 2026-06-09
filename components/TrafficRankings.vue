<script setup lang="ts">
import type { Component } from 'vue'
import { formatBytes } from '~/utils'

interface AggregatedData {
  label: string
  upload: number
  download: number
  total: number
  count: number
}

defineProps<{
  title: string
  icon?: Component
  data: AggregatedData[]
  selectedRow: string | null
}>()

const emit = defineEmits<{
  (e: 'select', label: string): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <!-- Header -->
    <div class="mb-4 flex items-center gap-2 font-semibold text-base-content">
      <component :is="icon" v-if="icon" :size="20" />
      <h3>{{ title }}</h3>
    </div>

    <!-- List -->
    <div class="flex-1 touch-pan-y overflow-y-auto pr-2">
      <div
        v-for="row in data"
        :key="row.label"
        class="mb-2 flex cursor-pointer flex-col gap-1 rounded-lg p-2 transition-colors hover:bg-base-content/5"
        :class="{
          'bg-primary/10! shadow-sm': selectedRow === row.label,
        }"
        @click="emit('select', row.label)"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="min-w-0 flex-1 truncate font-mono text-sm font-medium"
            :class="
              selectedRow === row.label ? 'text-primary' : 'text-base-content'
            "
            >{{ row.label }}</span
          >
          <span
            class="shrink-0 text-xs font-black"
            :class="
              selectedRow === row.label
                ? 'text-primary'
                : 'text-base-content/80'
            "
            >{{ formatBytes(row.total) }}</span
          >
        </div>

        <div class="flex items-center gap-3 text-[10px] font-bold opacity-60">
          <div class="flex items-center gap-1">
            <span class="uppercase opacity-50">↑</span>
            <span>{{ formatBytes(row.upload) }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="uppercase opacity-50">↓</span>
            <span>{{ formatBytes(row.download) }}</span>
          </div>
        </div>
      </div>
      <div
        v-if="!data.length"
        class="py-8 text-center text-sm text-base-content/60"
      >
        {{ t('noData') }}
      </div>
    </div>
  </div>
</template>
