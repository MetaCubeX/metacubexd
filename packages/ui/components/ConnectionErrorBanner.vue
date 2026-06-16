<script setup lang="ts">
import { useVersionQuery } from '~/composables/useQueries'

const { t } = useI18n()
const router = useRouter()
const endpointStore = useEndpointStore()
const kernelStore = useKernelStore()
const { isDesktop, isMac } = useDesktop()
const { hasFeature, ready: controlReady } = useControlInfo()

const { isError, refetch, isFetching } = useVersionQuery()

// The desktop app serves the Clash API from the managed kernel, so a stopped
// kernel makes the version probe fail by design — that's an expected state, not
// a fault to alarm about. Only surface the banner while the kernel is actually
// running. The web dashboard has no kernel-control feature, so it keeps the
// original "show on any backend error" behavior. Gate on the control-info
// probe's `ready` flag (as ProtectedResources does) so we don't flash the
// web-fallback banner during the brief window before we know whether a managed
// kernel is in play.
const showBanner = computed(() => {
  if (!isError.value) return false
  if (!controlReady.value) return false
  if (!hasFeature('kernel-control')) return true
  return kernelStore.state?.status === 'running'
})

// macOS frameless window keeps the native traffic lights in the top-left
// (trafficLightPosition x:12, a ~66px-wide cluster). The banner is fixed at
// top-0 over the title bar, so its content must clear that zone or the lights
// overlap the icon/text — pad the left only on macOS desktop.
const isMacDesktop = isDesktop && isMac

function switchEndpoint() {
  endpointStore.setSelectedEndpoint('')
  router.push('/setup')
}
</script>

<template>
  <Transition
    enter-active-class="transition-[transform,opacity] duration-300 ease-[var(--ease-snappy)]"
    enter-from-class="-translate-y-full opacity-0"
    leave-active-class="transition-[transform,opacity] duration-200 ease-[var(--ease-soft)]"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="showBanner"
      class="animate-shake-soft fixed top-0 right-0 left-0 z-[100] flex items-center justify-between gap-2 bg-error/90 py-2 text-error-content backdrop-blur-sm"
      :class="isMacDesktop ? 'pr-4 pl-20' : 'px-4'"
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
  </Transition>
</template>
