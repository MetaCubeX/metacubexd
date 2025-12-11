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
  <div class="join shrink-0">
    <button
      class="btn join-item btn-xs"
      :disabled="currentPage === 0"
      @click="emit('goToPage', 0)"
    >
      <IconChevronsLeft :size="14" />
    </button>
    <button
      class="btn join-item btn-xs"
      :disabled="currentPage === 0"
      @click="emit('previous')"
    >
      <IconChevronLeft :size="14" />
    </button>

    <template v-for="(page, index) in visiblePages" :key="page">
      <span
        v-if="index > 0 && visiblePages[index - 1] !== page - 1"
        class="flex items-center px-1 text-xs text-base-content/40"
      >
        ···
      </span>
      <button
        class="btn join-item min-w-8 btn-xs"
        :class="{ 'btn-active': currentPage === page }"
        @click="emit('goToPage', page)"
      >
        {{ page + 1 }}
      </button>
    </template>

    <button
      class="btn join-item btn-xs"
      :disabled="currentPage >= totalPages - 1"
      @click="emit('next')"
    >
      <IconChevronRight :size="14" />
    </button>
    <button
      class="btn join-item btn-xs"
      :disabled="currentPage >= totalPages - 1"
      @click="emit('goToPage', totalPages - 1)"
    >
      <IconChevronsRight :size="14" />
    </button>
  </div>
</template>
