<script setup lang="ts">
import { IconArrowsSort } from '@tabler/icons-vue'
import { PROXIES_ORDERING_TYPE, PROXIES_ORDERING_TYPE_ORDER } from '~/constants'

const configStore = useConfigStore()
const { t } = useI18n()

// Compact menu labels — the full descriptive strings ("By latency from low to
// high") are too wide. Dimension words reuse existing i18n keys; direction is a
// language-neutral arrow / A-Z.
function shortLabel(type: PROXIES_ORDERING_TYPE): string {
  switch (type) {
    case PROXIES_ORDERING_TYPE.LATENCY_ASC:
      return `${t('latency')} ↑`
    case PROXIES_ORDERING_TYPE.LATENCY_DESC:
      return `${t('latency')} ↓`
    case PROXIES_ORDERING_TYPE.QUALITY_ASC:
      return `${t('quality')} ↑`
    case PROXIES_ORDERING_TYPE.QUALITY_DESC:
      return `${t('quality')} ↓`
    case PROXIES_ORDERING_TYPE.NAME_ASC:
      return `${t('name')} A-Z`
    case PROXIES_ORDERING_TYPE.NAME_DESC:
      return `${t('name')} Z-A`
    default:
      return t('sortDefault')
  }
}

const options = computed(() =>
  PROXIES_ORDERING_TYPE_ORDER.map((type) => ({
    value: type,
    label: shortLabel(type),
  })),
)
</script>

<template>
  <IconMenuSelect
    :icon="IconArrowsSort"
    :title="t('sortBy')"
    :options="options"
    :model-value="configStore.proxiesOrderingType"
    @update:model-value="
      (v: string) =>
        (configStore.proxiesOrderingType = v as PROXIES_ORDERING_TYPE)
    "
  />
</template>
