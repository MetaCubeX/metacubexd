<script setup lang="ts">
import { IconLanguage } from '@tabler/icons-vue'

const { locale, locales, setLocale } = useI18n()

const availableLocales = computed(() =>
  locales.value.map((l) => (typeof l === 'string' ? { code: l, name: l } : l)),
)
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
      <li v-for="lang in availableLocales" :key="lang.code">
        <button
          :class="{ 'menu-active': locale === lang.code }"
          @click="setLocale(lang.code)"
        >
          {{ lang.name }}
        </button>
      </li>
    </ul>
  </div>
</template>
