<!-- packages/ui/components/KernelVersionPanel.vue -->
<script setup lang="ts">
import { IconCpu, IconDatabase, IconDownload } from '@tabler/icons-vue'

const { t } = useI18n()
const kernelVersions = useKernelVersions()
const geo = useGeoAssets()

const {
  available: versionsAvailable,
  versions,
  current,
  bundled,
  selected,
  loading,
  switching,
} = kernelVersions
const { available: geoAvailable, updating } = geo

// The whole card renders when at least one of its capabilities is present.
const cardVisible = computed(
  () => versionsAvailable.value || geoAvailable.value,
)

onMounted(() => {
  if (!versionsAvailable.value) return
  kernelVersions.load()
})
</script>

<template>
  <div
    v-if="cardVisible"
    class="rounded-xl border border-base-content/10 bg-base-200 p-4"
  >
    <!-- Kernel version manager -->
    <template v-if="versionsAvailable">
      <div class="mb-3 flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 font-semibold text-base-content">
          <IconCpu :size="18" />
          {{ t('kernelVersionManager') }}
        </span>
      </div>

      <div class="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div class="flex flex-col">
          <span class="text-base-content/60">{{
            t('kernelVersionCurrent')
          }}</span>
          <span class="tabular-nums">{{ current ?? '-' }}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-base-content/60">{{
            t('kernelVersionBundled')
          }}</span>
          <span class="tabular-nums">{{ bundled || '-' }}</span>
        </div>
      </div>

      <label class="mb-1 flex flex-col gap-1 text-sm">
        <span class="text-base-content/60">{{ t('kernelVersionSelect') }}</span>
        <select
          v-model="selected"
          class="select-bordered select w-full select-sm"
          :disabled="loading || switching || versions.length === 0"
        >
          <option v-for="v in versions" :key="v" :value="v">
            {{ v }}{{ v === current ? ` (${t('kernelVersionActive')})` : '' }}
          </option>
        </select>
      </label>

      <div class="mt-3 flex flex-wrap gap-2">
        <Button
          class="btn-sm btn-primary"
          :icon="IconDownload"
          :loading="switching"
          :disabled="loading || switching || !selected || selected === current"
          @click="kernelVersions.switch()"
        >
          {{ t('kernelVersionSwitch') }}
        </Button>
      </div>
    </template>

    <!-- Geo databases -->
    <template v-if="geoAvailable">
      <div
        class="flex items-center justify-between gap-2"
        :class="{
          'mt-4 border-t border-base-content/10 pt-4': versionsAvailable,
        }"
      >
        <span class="flex items-center gap-2 font-semibold text-base-content">
          <IconDatabase :size="18" />
          {{ t('geoAssets') }}
        </span>
        <Button
          class="btn-sm btn-secondary"
          :icon="IconDownload"
          :loading="updating"
          :disabled="updating"
          @click="geo.update()"
        >
          {{ t('geoUpdate') }}
        </Button>
      </div>
      <p class="mt-2 text-sm text-base-content/60">
        {{ t('geoAssetsDescription') }}
      </p>
    </template>
  </div>
</template>
