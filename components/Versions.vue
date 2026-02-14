<script setup lang="ts">
import type { ReleaseInfo } from '~/types'
import {
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from '@floating-ui/vue'
import {
  backendReleaseAPI,
  fetchBackendReleasesAPI,
  fetchFrontendReleasesAPI,
  frontendReleaseAPI,
  useConfigActions,
} from '~/composables/useApi'
import { useVersionQuery } from '~/composables/useQueries'

interface Props {
  frontendVersion?: string
  backendVersion?: string
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  frontendVersion: '',
  backendVersion: '',
  collapsed: false,
})

// Get versions from runtime config and queries if not provided
const runtimeConfig = useRuntimeConfig()
const { data: queryBackendVersion } = useVersionQuery()

const actualFrontendVersion = computed(
  () =>
    props.frontendVersion || `v${runtimeConfig.public.appVersion || '0.0.0'}`,
)
const actualBackendVersion = computed(
  () => props.backendVersion || queryBackendVersion.value || '',
)

// Use config actions composable for upgrade functions
const configActions = useConfigActions()

const frontendRelease = ref<{
  isUpdateAvailable: boolean
  changelog?: string
}>()
const backendRelease = ref<{ isUpdateAvailable: boolean; changelog?: string }>()

const frontendReleases = ref<ReleaseInfo[]>([])
const backendReleases = ref<ReleaseInfo[]>([])

const isLoadingFrontendReleases = ref(true)
const isLoadingBackendReleases = ref(true)

// Computed for loading states
const upgradingUI = computed(() => configActions.upgradingUI.value)
const upgradingBackend = computed(() => configActions.upgradingBackend.value)

// Floating UI for frontend tooltip
const frontendReference = ref<HTMLElement | null>(null)
const frontendFloating = ref<HTMLElement | null>(null)
const frontendArrow = ref<HTMLElement | null>(null)
const isFrontendTooltipOpen = ref(false)

const {
  floatingStyles: frontendFloatingStyles,
  middlewareData: frontendMiddlewareData,
  placement: frontendPlacement,
} = useFloating(frontendReference, frontendFloating, {
  placement: 'top',
  middleware: [
    offset(10),
    flip(),
    shift({ padding: 8 }),
    arrow({ element: frontendArrow }),
  ],
  whileElementsMounted: autoUpdate,
})

// Floating UI for backend tooltip
const backendReference = ref<HTMLElement | null>(null)
const backendFloating = ref<HTMLElement | null>(null)
const backendArrow = ref<HTMLElement | null>(null)
const isBackendTooltipOpen = ref(false)

const {
  floatingStyles: backendFloatingStyles,
  middlewareData: backendMiddlewareData,
  placement: backendPlacement,
} = useFloating(backendReference, backendFloating, {
  placement: 'top',
  middleware: [
    offset(10),
    flip(),
    shift({ padding: 8 }),
    arrow({ element: backendArrow }),
  ],
  whileElementsMounted: autoUpdate,
})

// Arrow positioning helper
function getArrowStyles(
  middlewareData: { arrow?: { x?: number; y?: number } },
  placement: string,
) {
  const arrowData = middlewareData.arrow
  const side = placement.split('-')[0] || 'top'

  const staticSide: Record<string, string> = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }

  const sideKey = staticSide[side] || 'bottom'

  return {
    left: arrowData?.x != null ? `${arrowData.x}px` : '',
    top: arrowData?.y != null ? `${arrowData.y}px` : '',
    [sideKey]: '-4px',
  }
}

const frontendArrowStyles = computed(() =>
  getArrowStyles(frontendMiddlewareData.value, frontendPlacement.value),
)

const backendArrowStyles = computed(() =>
  getArrowStyles(backendMiddlewareData.value, backendPlacement.value),
)

// Hover timeout handlers
let frontendOpenTimeout: ReturnType<typeof setTimeout> | null = null
let frontendCloseTimeout: ReturnType<typeof setTimeout> | null = null
let backendOpenTimeout: ReturnType<typeof setTimeout> | null = null
let backendCloseTimeout: ReturnType<typeof setTimeout> | null = null

function clearFrontendTimeouts() {
  if (frontendOpenTimeout) {
    clearTimeout(frontendOpenTimeout)
    frontendOpenTimeout = null
  }
  if (frontendCloseTimeout) {
    clearTimeout(frontendCloseTimeout)
    frontendCloseTimeout = null
  }
}

function clearBackendTimeouts() {
  if (backendOpenTimeout) {
    clearTimeout(backendOpenTimeout)
    backendOpenTimeout = null
  }
  if (backendCloseTimeout) {
    clearTimeout(backendCloseTimeout)
    backendCloseTimeout = null
  }
}

function onFrontendMouseEnter() {
  clearFrontendTimeouts()
  frontendOpenTimeout = setTimeout(() => {
    isFrontendTooltipOpen.value = true
  }, 200)
}

function onFrontendMouseLeave() {
  clearFrontendTimeouts()
  frontendCloseTimeout = setTimeout(() => {
    isFrontendTooltipOpen.value = false
  }, 100)
}

function onFrontendTooltipMouseEnter() {
  clearFrontendTimeouts()
}

function onFrontendTooltipMouseLeave() {
  clearFrontendTimeouts()
  isFrontendTooltipOpen.value = false
}

function onBackendMouseEnter() {
  clearBackendTimeouts()
  backendOpenTimeout = setTimeout(() => {
    isBackendTooltipOpen.value = true
  }, 200)
}

function onBackendMouseLeave() {
  clearBackendTimeouts()
  backendCloseTimeout = setTimeout(() => {
    isBackendTooltipOpen.value = false
  }, 100)
}

function onBackendTooltipMouseEnter() {
  clearBackendTimeouts()
}

function onBackendTooltipMouseLeave() {
  clearBackendTimeouts()
  isBackendTooltipOpen.value = false
}

// Fetch release info
async function fetchReleaseInfo() {
  if (!actualFrontendVersion.value || !actualBackendVersion.value) return

  try {
    frontendRelease.value = await frontendReleaseAPI(
      actualFrontendVersion.value,
    )
  } catch (err) {
    console.error('Failed to fetch frontend release:', err)
  }

  try {
    backendRelease.value = await backendReleaseAPI(actualBackendVersion.value)
  } catch (err) {
    console.error('Failed to fetch backend release:', err)
  }
}

// Fetch releases list
async function fetchReleases() {
  isLoadingFrontendReleases.value = true
  isLoadingBackendReleases.value = true

  try {
    frontendReleases.value = await fetchFrontendReleasesAPI(
      actualFrontendVersion.value,
      10,
    )
  } catch (err) {
    console.error('Failed to fetch frontend releases:', err)
  } finally {
    isLoadingFrontendReleases.value = false
  }

  try {
    backendReleases.value = await fetchBackendReleasesAPI(
      actualBackendVersion.value,
      10,
    )
  } catch (err) {
    console.error('Failed to fetch backend releases:', err)
  } finally {
    isLoadingBackendReleases.value = false
  }
}

// Upgrade handlers
async function handleFrontendUpgrade() {
  if (upgradingUI.value || !frontendRelease.value?.isUpdateAvailable) return

  await configActions.upgradeUIAPI()
  window.location.reload()
}

async function handleBackendUpgrade() {
  if (upgradingBackend.value || !backendRelease.value?.isUpdateAvailable) return

  await configActions.upgradeBackendAPI()
  window.location.reload()
}

// Watch for backend version changes
watch(
  actualBackendVersion,
  (newVersion) => {
    if (newVersion) {
      fetchReleaseInfo()
      fetchReleases()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="!collapsed" class="mx-2 grid grid-cols-1 gap-2 pt-1 md:mx-0">
    <!-- Frontend Version -->
    <div
      ref="frontendReference"
      role="button"
      class="version-badge relative flex w-full cursor-pointer items-center justify-center overflow-visible rounded-md p-2 transition-all duration-200 ease-in-out"
      @click="handleFrontendUpgrade"
      @mouseenter="onFrontendMouseEnter"
      @mouseleave="onFrontendMouseLeave"
    >
      <!-- Update indicator -->
      <span
        v-if="frontendRelease?.isUpdateAvailable"
        class="absolute top-0 right-0 inline-grid translate-x-1/2 -translate-y-1/2"
      >
        <span
          class="col-start-1 row-start-1 h-2 w-2 animate-ping rounded-full bg-info"
        />
        <span class="col-start-1 row-start-1 h-2 w-2 rounded-full bg-info" />
      </span>

      <div class="flex w-full items-center justify-center gap-2 text-xs">
        {{ actualFrontendVersion }}
        <span
          v-if="upgradingUI"
          class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      </div>
    </div>

    <!-- Frontend Changelog Tooltip -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isFrontendTooltipOpen"
          ref="frontendFloating"
          :style="frontendFloatingStyles"
          class="z-70 max-h-96 overflow-y-auto rounded-xl bg-neutral p-4 text-neutral-content shadow-xl"
          @mouseenter="onFrontendTooltipMouseEnter"
          @mouseleave="onFrontendTooltipMouseLeave"
        >
          <!-- Arrow -->
          <div
            ref="frontendArrow"
            class="absolute h-2 w-2 rotate-45 bg-neutral"
            :style="frontendArrowStyles"
          />
          <Changelog
            :releases="frontendReleases"
            :is-loading="isLoadingFrontendReleases"
          />
        </div>
      </Transition>
    </Teleport>

    <!-- Backend Version -->
    <div
      ref="backendReference"
      role="button"
      class="version-badge relative flex w-full cursor-pointer items-center justify-center overflow-visible rounded-md p-2 transition-all duration-200 ease-in-out"
      @click="handleBackendUpgrade"
      @mouseenter="onBackendMouseEnter"
      @mouseleave="onBackendMouseLeave"
    >
      <!-- Update indicator -->
      <span
        v-if="backendRelease?.isUpdateAvailable"
        class="absolute top-0 right-0 inline-grid translate-x-1/2 -translate-y-1/2"
      >
        <span
          class="col-start-1 row-start-1 h-2 w-2 animate-ping rounded-full bg-info"
        />
        <span class="col-start-1 row-start-1 h-2 w-2 rounded-full bg-info" />
      </span>

      <div class="flex w-full items-center justify-center gap-2 text-xs">
        {{ actualBackendVersion }}
        <span
          v-if="upgradingBackend"
          class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      </div>
    </div>

    <!-- Backend Changelog Tooltip -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isBackendTooltipOpen"
          ref="backendFloating"
          :style="backendFloatingStyles"
          class="z-70 max-h-96 overflow-y-auto rounded-xl bg-neutral p-4 text-neutral-content shadow-xl"
          @mouseenter="onBackendTooltipMouseEnter"
          @mouseleave="onBackendTooltipMouseLeave"
        >
          <!-- Arrow -->
          <div
            ref="backendArrow"
            class="absolute h-2 w-2 rotate-45 bg-neutral"
            :style="backendArrowStyles"
          />
          <Changelog
            :releases="backendReleases"
            :is-loading="isLoadingBackendReleases"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.version-badge {
  border: 1px solid
    color-mix(in oklch, var(--color-base-content) 20%, transparent);
  background: color-mix(in oklch, var(--color-base-200) 80%, transparent);
  color: var(--color-base-content);
}

.version-badge:hover {
  background: color-mix(in oklch, var(--color-base-content) 10%, transparent);
}
</style>
