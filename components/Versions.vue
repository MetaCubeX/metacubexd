<script setup lang="ts">
import type { ReleaseInfo } from '~/types'
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
    <div class="dropdown dropdown-top w-full">
      <kbd
        tabindex="0"
        role="button"
        class="relative kbd w-full cursor-pointer py-4"
        @click="handleFrontendUpgrade"
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
          <span
            v-if="upgradingUI"
            class="loading loading-sm loading-infinity"
          />
        </div>
      </kbd>

      <div
        tabindex="0"
        class="dropdown-content z-50 max-h-96 overflow-y-auto rounded-box bg-neutral p-4 shadow-xl"
      >
        <Changelog
          :releases="frontendReleases"
          :is-loading="isLoadingFrontendReleases"
        />
      </div>
    </div>

    <!-- Backend Version -->
    <div class="dropdown dropdown-top w-full">
      <kbd
        tabindex="0"
        role="button"
        class="relative kbd w-full cursor-pointer py-4"
        @click="handleBackendUpgrade"
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

      <div
        tabindex="0"
        class="dropdown-content z-50 max-h-96 overflow-y-auto rounded-box bg-neutral p-4 shadow-xl"
      >
        <Changelog
          :releases="backendReleases"
          :is-loading="isLoadingBackendReleases"
        />
      </div>
    </div>
  </div>
</template>
