<script setup lang="ts">
import { IconArrowsSort } from '@tabler/icons-vue'
import { PROXIES_ORDERING_TYPE_ORDER } from '~/constants'

const configStore = useConfigStore()
const { t } = useI18n()
</script>

<template>
  <label
    class="flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-base-content/10 bg-base-200/80 px-2.5 text-base-content/70 transition-all duration-200 focus-within:border-primary/40 hover:border-primary/30 hover:text-primary"
    :title="t('sortBy')"
  >
    <IconArrowsSort :size="16" class="shrink-0 opacity-60" />
    <select
      v-model="configStore.proxiesOrderingType"
      class="max-w-32 cursor-pointer appearance-none bg-transparent text-sm outline-none sm:max-w-44"
      :aria-label="t('sortBy')"
    >
      <option
        v-for="type in PROXIES_ORDERING_TYPE_ORDER"
        :key="type"
        :value="type"
      >
        {{ t(type) }}
      </option>
    </select>
  </label>
</template>
