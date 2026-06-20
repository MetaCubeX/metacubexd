<script setup lang="ts">
import { IconDimensions } from '@tabler/icons-vue'
import { PROXIES_CARD_SIZE } from '~/constants'

const configStore = useConfigStore()
const { t } = useI18n()

const options = computed(() => [
  { value: PROXIES_CARD_SIZE.COMFORTABLE, label: t('cardSizeComfortable') },
  { value: PROXIES_CARD_SIZE.COMPACT, label: t('cardSizeCompact') },
  { value: PROXIES_CARD_SIZE.TIGHT, label: t('cardSizeTight') },
])
</script>

<template>
  <IconMenuSelect
    :icon="IconDimensions"
    :title="t('proxiesCardSize')"
    :options="options"
    :model-value="configStore.proxiesCardSize"
    @update:model-value="
      (v: string) => (configStore.proxiesCardSize = v as PROXIES_CARD_SIZE)
    "
  />
</template>
