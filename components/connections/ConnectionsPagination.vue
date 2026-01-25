<script setup lang="ts">
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '@tabler/icons-vue'

defineProps<{
  currentPage: number
  totalPages: number
  visiblePages: number[]
}>()

const emit = defineEmits<{
  goToPage: [page: number]
  previous: []
  next: []
}>()
</script>

<template>
  <div
    class="flex shrink-0 items-center overflow-hidden rounded-lg border border-base-content/12"
  >
    <button
      class="flex h-7 min-w-7 cursor-pointer items-center justify-center border-r border-none border-r-base-content/10 bg-base-200/80 px-1.5 text-xs text-base-content transition-all duration-150 ease-out hover:not-disabled:bg-base-content/10 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="currentPage === 0"
      @click="emit('goToPage', 0)"
    >
      <IconChevronsLeft :size="14" />
    </button>
    <button
      class="flex h-7 min-w-7 cursor-pointer items-center justify-center border-r border-none border-r-base-content/10 bg-base-200/80 px-1.5 text-xs text-base-content transition-all duration-150 ease-out hover:not-disabled:bg-base-content/10 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="currentPage === 0"
      @click="emit('previous')"
    >
      <IconChevronLeft :size="14" />
    </button>

    <template v-for="(page, index) in visiblePages" :key="page">
      <span
        v-if="index > 0 && visiblePages[index - 1] !== page - 1"
        class="flex items-center border-r border-r-base-content/10 bg-base-200/80 px-1 text-xs text-base-content/40"
      >
        ···
      </span>
      <button
        class="flex h-7 min-w-8 cursor-pointer items-center justify-center border-r border-none border-r-base-content/10 bg-base-200/80 px-1.5 text-xs text-base-content transition-all duration-150 ease-out last:border-r-0 hover:not-disabled:bg-base-content/10 disabled:cursor-not-allowed disabled:opacity-40"
        :class="{
          'bg-primary! text-primary-content! hover:bg-primary!':
            currentPage === page,
        }"
        @click="emit('goToPage', page)"
      >
        {{ page + 1 }}
      </button>
    </template>

    <button
      class="flex h-7 min-w-7 cursor-pointer items-center justify-center border-r border-none border-r-base-content/10 bg-base-200/80 px-1.5 text-xs text-base-content transition-all duration-150 ease-out last:border-r-0 hover:not-disabled:bg-base-content/10 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="currentPage >= totalPages - 1"
      @click="emit('next')"
    >
      <IconChevronRight :size="14" />
    </button>
    <button
      class="flex h-7 min-w-7 cursor-pointer items-center justify-center border-none bg-base-200/80 px-1.5 text-xs text-base-content transition-all duration-150 ease-out last:border-r-0 hover:not-disabled:bg-base-content/10 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="currentPage >= totalPages - 1"
      @click="emit('goToPage', totalPages - 1)"
    >
      <IconChevronsRight :size="14" />
    </button>
  </div>
</template>
