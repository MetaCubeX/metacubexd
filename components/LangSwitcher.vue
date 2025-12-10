<script setup lang="ts">
import { IconLanguage } from '@tabler/icons-vue'
import { LANG } from '~/constants'

const configStore = useConfigStore()

const languages = [
  { value: LANG.EN, label: 'English' },
  { value: LANG.ZH, label: '简体中文' },
  { value: LANG.RU, label: 'Русский' },
]
</script>

<template>
  <div class="dropdown dropdown-end">
    <div
      tabindex="0"
      role="button"
      class="btn btn-circle btn-ghost"
      aria-label="Change language"
    >
      <IconLanguage :size="20" />
    </div>

    <ul
      tabindex="0"
      class="dropdown-content menu z-50 mt-2 w-40 rounded-box bg-base-200 p-2 shadow-lg"
    >
      <li v-for="lang in languages" :key="lang.value">
        <button
          :class="{ 'menu-active': configStore.locale === lang.value }"
          @click="configStore.locale = lang.value"
        >
          {{ lang.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
