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

interface Props {
  frontendVersion: string
  backendVersion: string
}

const props = defineProps<Props>()

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
  try {
    frontendRelease.value = await frontendReleaseAPI(props.frontendVersion)
  } catch (err) {
    console.error('Failed to fetch frontend release:', err)
  }

  try {
    backendRelease.value = await backendReleaseAPI(props.backendVersion)
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
      props.frontendVersion,
      10,
    )
  } catch (err) {
    console.error('Failed to fetch frontend releases:', err)
  } finally {
    isLoadingFrontendReleases.value = false
  }

  try {
    backendReleases.value = await fetchBackendReleasesAPI(
      props.backendVersion,
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
  if (upgradingUI.value) return

  await configActions.upgradeUIAPI()
  window.location.reload()
}

async function handleBackendUpgrade() {
  if (upgradingBackend.value) return

  await configActions.upgradeBackendAPI()
  window.location.reload()
}

// Watch for backend version changes
watch(
  () => props.backendVersion,
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
  <div class="mx-2 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mx-0">
    <!-- Frontend Version -->
    <kbd
      ref="frontendReference"
      role="button"
      class="relative kbd w-full cursor-pointer py-4"
      @click="handleFrontendUpgrade"
      @mouseenter="onFrontendMouseEnter"
      @mouseleave="onFrontendMouseLeave"
    >
      <!-- Update indicator -->
      <span
        v-if="frontendRelease?.isUpdateAvailable"
        class="absolute -top-1 -right-1 inline-grid *:[grid-area:1/1]"
      >
        <span class="status animate-ping status-info" />
        <div class="status status-info" />
      </span>

      <div class="flex w-full items-center justify-center gap-2">
        {{ frontendVersion }}
        <span v-if="upgradingUI" class="loading loading-sm loading-infinity" />
      </div>
    </kbd>

    <!-- Frontend Changelog Tooltip -->
    <Teleport to="body">
      <div
        v-if="isFrontendTooltipOpen"
        ref="frontendFloating"
        :style="frontendFloatingStyles"
        class="z-50 max-h-96 overflow-y-auto rounded-box bg-neutral p-4 text-neutral-content shadow-xl"
        @mouseenter="onFrontendTooltipMouseEnter"
        @mouseleave="onFrontendTooltipMouseLeave"
      >
        <!-- Arrow -->
        <div
          ref="frontendArrow"
          class="absolute size-2 rotate-45 bg-neutral"
          :style="frontendArrowStyles"
        />
        <Changelog
          :releases="frontendReleases"
          :is-loading="isLoadingFrontendReleases"
        />
      </div>
    </Teleport>

    <!-- Backend Version -->
    <kbd
      ref="backendReference"
      role="button"
      class="relative kbd w-full cursor-pointer py-4"
      @click="handleBackendUpgrade"
      @mouseenter="onBackendMouseEnter"
      @mouseleave="onBackendMouseLeave"
    >
      <!-- Update indicator -->
      <span
        v-if="backendRelease?.isUpdateAvailable"
        class="absolute -top-1 -right-1 inline-grid *:[grid-area:1/1]"
      >
        <span class="status animate-ping status-info" />
        <div class="status status-info" />
      </span>

      <div class="flex w-full items-center justify-center gap-2">
        {{ backendVersion }}
        <span
          v-if="upgradingBackend"
          class="loading loading-sm loading-infinity"
        />
      </div>
    </kbd>

    <!-- Backend Changelog Tooltip -->
    <Teleport to="body">
      <div
        v-if="isBackendTooltipOpen"
        ref="backendFloating"
        :style="backendFloatingStyles"
        class="z-50 max-h-96 overflow-y-auto rounded-box bg-neutral p-4 text-neutral-content shadow-xl"
        @mouseenter="onBackendTooltipMouseEnter"
        @mouseleave="onBackendTooltipMouseLeave"
      >
        <!-- Arrow -->
        <div
          ref="backendArrow"
          class="absolute size-2 rotate-45 bg-neutral"
          :style="backendArrowStyles"
        />
        <Changelog
          :releases="backendReleases"
          :is-loading="isLoadingBackendReleases"
        />
      </div>
    </Teleport>
  </div>
</template>
