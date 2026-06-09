<script setup lang="ts">
import { useVersionQuery } from '~/composables/useQueries'

const { t } = useI18n()
const router = useRouter()
const endpointStore = useEndpointStore()

const { isError, refetch, isFetching } = useVersionQuery()

function switchEndpoint() {
  endpointStore.setSelectedEndpoint('')
  router.push('/setup')
}
</script>

<template>
  <div
    v-if="isError"
    class="fixed top-0 right-0 left-0 z-[100] flex items-center justify-between gap-2 bg-error/90 px-4 py-2 text-error-content backdrop-blur-sm"
  >
    <div class="flex min-w-0 items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="size-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"
        />
      </svg>
      <span class="truncate text-sm font-medium">
        {{ t('connectionError') }}
      </span>
      <span class="hidden truncate text-xs opacity-80 sm:inline">
        {{ endpointStore.currentEndpoint?.url }}
      </span>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button
        class="btn text-error-content btn-ghost btn-xs hover:bg-error-content/20"
        :disabled="isFetching"
        @click="() => refetch()"
      >
        <span v-if="isFetching" class="loading loading-xs loading-spinner" />
        <span v-else>{{ t('retry') }}</span>
      </button>
      <button
        class="btn bg-error-content/20 text-error-content btn-xs hover:bg-error-content/30"
        @click="switchEndpoint"
      >
        {{ t('switchEndpoint') }}
      </button>
    </div>
  </div>
</template>
