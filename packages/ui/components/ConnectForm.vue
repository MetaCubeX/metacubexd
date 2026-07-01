<script setup lang="ts">
import { IconLink, IconLock } from '@tabler/icons-vue'
import { FALLBACK_BACKEND_URL } from '~/constants'

defineProps<{ submitLabel: string }>()

const { t } = useI18n()
const endpointStore = useEndpointStore()

const {
  endpointError,
  isSubmitting,
  defaultBackendURL,
  connect,
  selectEndpoint,
  autoLogin,
} = useConnect()

const formData = reactive({ url: '', secret: '' })

const currentOrigin = computed(() =>
  typeof window === 'undefined' ? '' : window.location.origin,
)

// The parent page drives the on-mount auto-connect against THIS form's fields
// (so a failed probe leaves them populated to edit), and reconnects to a saved
// endpoint from the /setup list — both surface through this form's error state.
defineExpose({
  selectEndpoint,
  autoLogin: (query: Record<string, any>, options?: { tryDefault?: boolean }) =>
    autoLogin(query, formData, options),
})
</script>

<template>
  <div class="rounded-box border border-base-content/10 bg-base-200 p-6">
    <form
      class="flex flex-col gap-5"
      @submit.prevent="connect(formData.url, formData.secret)"
    >
      <!-- Endpoint URL -->
      <div class="flex flex-col gap-2">
        <label
          class="flex items-center gap-2 text-sm font-medium text-base-content/80"
          for="url"
        >
          <IconLink :size="16" />
          <span>{{ t('endpointURL') }}</span>
        </label>
        <input
          id="url"
          v-model="formData.url"
          type="url"
          class="w-full rounded-lg border border-base-content/15 bg-base-100 px-4 py-3 text-base text-base-content transition-colors duration-200 placeholder:text-base-content/80"
          placeholder="http(s)://{hostname}:{port}"
          list="defaultEndpoints"
          autocomplete="on"
        />
        <datalist id="defaultEndpoints">
          <option :value="FALLBACK_BACKEND_URL" />
          <option
            v-if="
              defaultBackendURL && defaultBackendURL !== FALLBACK_BACKEND_URL
            "
            :value="defaultBackendURL"
          />
          <option
            v-if="currentOrigin && currentOrigin !== FALLBACK_BACKEND_URL"
            :value="currentOrigin"
          />
          <option
            v-for="endpoint in endpointStore.endpointList"
            :key="endpoint.id"
            :value="endpoint.url"
          />
        </datalist>
      </div>

      <!-- Hidden username field for password managers -->
      <input
        type="text"
        name="username"
        autocomplete="username"
        class="sr-only"
        aria-hidden="true"
        tabindex="-1"
      />

      <!-- Secret -->
      <div class="flex flex-col gap-2">
        <label
          class="flex items-center gap-2 text-sm font-medium text-base-content/80"
          for="secret"
        >
          <IconLock :size="16" />
          <span>{{ t('secret') }}</span>
        </label>
        <input
          id="secret"
          v-model="formData.secret"
          type="password"
          class="w-full rounded-lg border border-base-content/15 bg-base-100 px-4 py-3 text-base text-base-content transition-colors duration-200 placeholder:text-base-content/80"
          placeholder="secret"
          autocomplete="current-password"
        />
        <p class="text-xs text-base-content/80">{{ t('secretHint') }}</p>
      </div>

      <!-- Error -->
      <div
        v-if="endpointError"
        role="alert"
        class="rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm text-error"
      >
        <template v-if="endpointError === 'mixed_content'">
          {{ t('mixedContentError') }}
        </template>
        <template v-else>
          {{ t('endpointConnectError') }}
        </template>
      </div>

      <Button type="submit" class="w-full btn-primary" :loading="isSubmitting">
        {{ submitLabel }}
      </Button>
    </form>
  </div>
</template>
