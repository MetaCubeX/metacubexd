<!-- packages/ui/components/ProfileImportHero.vue -->
<script setup lang="ts">
import type { ProfileMeta } from '~/types/control'
import { IconClipboard, IconDownload, IconFileUpload } from '@tabler/icons-vue'
import { toast } from 'vue-sonner'

// Shared subscription-import experience used by BOTH the first-run wizard
// (variant="wizard", chrome-less inside the overlay) and the /profiles page
// (variant="page", a prominent accent card). It performs the import via the
// control API directly (so it can return the created ProfileMeta), refreshes the
// shared profile-status singleton, and emits 'imported' so each parent decides
// what to do next (the wizard auto-activates; /profiles refreshes its grid).
withDefaults(defineProps<{ variant?: 'page' | 'wizard' }>(), {
  variant: 'page',
})

const emit = defineEmits<{ imported: [meta: ProfileMeta] }>()

const { t } = useI18n()
const api = useControlApi()
const profileStatus = useProfileStatus()

const url = ref('')
const name = ref('')
const busy = ref(false)
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// Reject pathologically large pastes/files early — a real subscription config is
// kilobytes, not megabytes.
const MAX_FILE_BYTES = 1024 * 1024

// Clipboard import is only offered where navigator.clipboard.readText exists
// (secure contexts). Hide the control entirely rather than show a dead button.
const clipboardSupported = ref(false)
onMounted(() => {
  clipboardSupported.value =
    typeof navigator !== 'undefined' && !!navigator.clipboard?.readText
})

const afterImport = async (meta: ProfileMeta) => {
  url.value = ''
  name.value = ''
  errorMessage.value = ''
  await profileStatus.refresh()
  emit('imported', meta)
  toast.success(t('profilesImportSuccess'))
}

const reportError = (e: unknown) => {
  errorMessage.value = e instanceof Error ? e.message : String(e)
  toast.error(t('profilesImportFailed'), { description: errorMessage.value })
}

const onImportUrl = async () => {
  const u = url.value.trim()
  if (!u || busy.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    const meta = await api.importProfile(u, name.value.trim() || undefined)
    await afterImport(meta)
  } catch (e) {
    reportError(e)
  } finally {
    busy.value = false
  }
}

const onPickFile = () => fileInput.value?.click()

const onFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-selecting the same file later
  if (!file) return
  if (file.size > MAX_FILE_BYTES) {
    errorMessage.value = t('onboardingFileTooLarge')
    return
  }
  busy.value = true
  errorMessage.value = ''
  try {
    const content = await file.text()
    const profileName =
      name.value.trim() || file.name.replace(/\.[^.]+$/, '') || 'Imported'
    const meta = await api.createProfile({ name: profileName, content })
    await afterImport(meta)
  } catch (e) {
    reportError(e)
  } finally {
    busy.value = false
  }
}

const onClipboard = async () => {
  if (busy.value) return
  errorMessage.value = ''
  let text = ''
  try {
    text = (await navigator.clipboard.readText()).trim()
  } catch {
    errorMessage.value = t('onboardingClipboardDenied')
    return
  }
  if (!text) {
    errorMessage.value = t('onboardingClipboardEmpty')
    return
  }
  // A URL prefills the field for an explicit confirm (reuses the validated URL
  // path); anything else is imported as inline profile content.
  if (/^https?:\/\//i.test(text)) {
    url.value = text
    return
  }
  busy.value = true
  try {
    const meta = await api.createProfile({
      name: name.value.trim() || 'Clipboard import',
      content: text,
    })
    await afterImport(meta)
  } catch (e) {
    reportError(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    :class="
      variant === 'page'
        ? 'rounded-xl border border-primary/20 bg-primary/5 p-5'
        : ''
    "
  >
    <div v-if="variant === 'page'" class="mb-4">
      <h2
        class="flex items-center gap-2 text-base font-semibold text-base-content"
      >
        <IconDownload :size="18" class="text-primary" />
        {{ t('profilesImportTitle') }}
      </h2>
      <p class="mt-1 text-sm text-base-content/60">
        {{ t('profilesImportSubtitle') }}
      </p>
    </div>

    <form class="flex flex-col gap-3" @submit.prevent="onImportUrl">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label class="flex flex-1 flex-col gap-1 text-sm">
          <span class="text-base-content/60">{{ t('profilesUrl') }}</span>
          <input
            v-model="url"
            type="url"
            class="input-bordered input input-sm w-full"
            placeholder="https://..."
            autocomplete="off"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm sm:w-40">
          <span class="text-base-content/60">{{ t('profilesName') }}</span>
          <input v-model="name" class="input-bordered input input-sm w-full" />
        </label>
        <Button
          type="submit"
          class="btn-sm btn-primary"
          :icon="IconDownload"
          :loading="busy"
          :disabled="!url.trim()"
        >
          {{ t('profilesImport') }}
        </Button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          class="btn-ghost btn-sm"
          :icon="IconFileUpload"
          :disabled="busy"
          @click="onPickFile"
        >
          {{ t('profilesImportFile') }}
        </Button>
        <Button
          v-if="clipboardSupported"
          class="btn-ghost btn-sm"
          :icon="IconClipboard"
          :disabled="busy"
          @click="onClipboard"
        >
          {{ t('profilesImportClipboard') }}
        </Button>
        <input
          ref="fileInput"
          type="file"
          accept=".yaml,.yml,.txt,application/x-yaml,text/yaml"
          class="hidden"
          @change="onFileChange"
        />
      </div>

      <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
    </form>
  </div>
</template>
