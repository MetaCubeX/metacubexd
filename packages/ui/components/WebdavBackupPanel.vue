<!-- packages/ui/components/WebdavBackupPanel.vue -->
<script setup lang="ts">
import { IconCloudDown, IconCloudUp, IconServerCog } from '@tabler/icons-vue'

const { t } = useI18n()
const webdav = useWebdavBackup()
const { available, config, busy } = webdav
</script>

<template>
  <div
    v-if="available"
    class="rounded-xl border border-base-content/10 bg-base-200 p-4"
  >
    <div class="mb-3 flex items-center gap-2">
      <span class="flex items-center gap-2 font-semibold text-base-content">
        <IconServerCog :size="18" />
        {{ t('webdavBackup') }}
      </span>
    </div>

    <p class="mb-3 text-sm text-base-content/60">
      {{ t('webdavBackupDescription') }}
    </p>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="flex flex-col gap-1 text-sm sm:col-span-2">
        <span class="text-base-content/60">{{ t('webdavUrl') }}</span>
        <input
          v-model="config.url"
          type="url"
          inputmode="url"
          class="input-bordered input input-sm w-full font-mono"
          :placeholder="t('webdavUrlPlaceholder')"
          :disabled="busy"
          spellcheck="false"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-base-content/60">{{ t('webdavUsername') }}</span>
        <input
          v-model="config.username"
          type="text"
          class="input-bordered input input-sm w-full"
          :disabled="busy"
          autocomplete="username"
          spellcheck="false"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="text-base-content/60">{{ t('webdavPassword') }}</span>
        <input
          v-model="config.password"
          type="password"
          class="input-bordered input input-sm w-full"
          :disabled="busy"
          autocomplete="current-password"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm sm:col-span-2">
        <span class="text-base-content/60">{{ t('webdavDir') }}</span>
        <input
          v-model="config.dir"
          type="text"
          class="input-bordered input input-sm w-full font-mono"
          :placeholder="t('webdavDirPlaceholder')"
          :disabled="busy"
          spellcheck="false"
        />
      </label>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        class="btn-sm btn-primary"
        :loading="busy"
        :disabled="!config.url"
        @click="webdav.backup()"
      >
        <IconCloudUp :size="16" />
        {{ t('webdavBackupNow') }}
      </Button>
      <Button
        class="btn-outline btn-sm btn-secondary"
        :loading="busy"
        :disabled="!config.url"
        @click="webdav.restore()"
      >
        <IconCloudDown :size="16" />
        {{ t('webdavRestore') }}
      </Button>
    </div>
  </div>
</template>
