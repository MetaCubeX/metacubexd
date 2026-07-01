<script setup lang="ts">
import { IconLink, IconLock } from '@tabler/icons-vue'
import { FALLBACK_BACKEND_URL } from '~/constants'

defineProps<{ submitLabel: string }>()

const { t } = useI18n()
const endpointStore = useEndpointStore()

const {
  endpointError,
  isSubmitting,
  probeState,
  probeTarget,
  defaultBackendURL,
  connect,
  selectEndpoint,
  autoLogin,
} = useConnect()

const formData = reactive({ url: '', secret: '' })

// Once the user touches the form, a lucky background default-probe hit must not
// navigate away from under them.
const userEngaged = ref(false)

const currentOrigin = computed(() =>
  typeof window === 'undefined' ? '' : window.location.origin,
)

// Live connection-status readout — the instrument. Hue lives only in the dot
// (an indicator LED bound to a semantic role); the label is always full-ink so
// it stays legible under every theme. First match wins.
const status = computed(() => {
  if (isSubmitting.value)
    return {
      dot: 'bg-info',
      pulse: true,
      label: t('statusConnecting'),
      target: formData.url,
    }
  if (endpointError.value === 'mixed_content')
    return {
      dot: 'bg-error',
      pulse: false,
      label: t('statusBlocked'),
      target: '',
    }
  if (endpointError.value === 'auth_error')
    return {
      dot: 'bg-error',
      pulse: false,
      label: t('statusAuthError'),
      target: formData.url,
    }
  if (endpointError.value === 'network_error')
    return {
      dot: 'bg-error',
      pulse: false,
      label: t('statusError'),
      target: formData.url,
    }
  if (probeState.value === 'probing')
    return {
      dot: 'bg-info',
      pulse: true,
      label: t('statusProbing'),
      target: probeTarget.value,
    }
  if (probeState.value === 'unreachable')
    return {
      dot: 'bg-warning',
      pulse: false,
      label: t('statusUnreachable'),
      target: probeTarget.value,
    }
  return {
    dot: 'bg-base-content/40',
    pulse: false,
    label: t('statusIdle'),
    target: '',
  }
})

// Once the user touches a field, drop any stale default-probe readout and
// cancel the lucky-default-hit navigation.
function onEdit() {
  userEngaged.value = true
  probeState.value = 'idle'
  probeTarget.value = ''
}

// The parent page drives the on-mount auto-connect against THIS form's fields
// (so a failed probe leaves them populated to edit) and reconnects to a saved
// endpoint from the /setup list — both surface through this form's state.
defineExpose({
  // Seed the fields from the saved endpoint so the status readout has a target
  // during the re-probe and the URL stays editable on failure.
  selectEndpoint: (id: string) => {
    const endpoint = endpointStore.endpointList.find((e) => e.id === id)
    if (endpoint) {
      formData.url = endpoint.url
      formData.secret = endpoint.secret
    }
    return selectEndpoint(id)
  },
  autoLogin: (query: Record<string, any>, options?: { tryDefault?: boolean }) =>
    autoLogin(query, formData, {
      ...options,
      shouldNavigate: () => !userEngaged.value,
    }),
})
</script>

<template>
  <div class="rounded-box border border-base-content/10 bg-base-200 p-6">
    <!-- Connection status readout (the instrument) -->
    <div class="mb-5 flex flex-col gap-1" role="status">
      <div class="flex items-center gap-2.5">
        <span class="relative flex size-2.5 shrink-0">
          <span
            v-if="status.pulse"
            class="absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping"
            :class="status.dot"
          />
          <span
            class="relative inline-flex size-2.5 rounded-full transition-colors duration-200"
            :class="status.dot"
          />
        </span>
        <span class="text-sm font-medium text-base-content">{{
          status.label
        }}</span>
      </div>
      <p
        v-if="status.target"
        class="truncate pl-[1.25rem] text-xs text-base-content/70 tabular-nums"
      >
        {{ status.target }}
      </p>
    </div>

    <form
      class="flex flex-col gap-5"
      @submit.prevent="connect(formData.url, formData.secret)"
      @focusin="userEngaged = true"
      @input="onEdit"
    >
      <!-- Endpoint URL -->
      <div class="flex flex-col gap-2">
        <label
          class="flex items-center gap-2 text-sm font-medium text-base-content"
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
          class="flex items-center gap-2 text-sm font-medium text-base-content"
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
          aria-describedby="secret-hint"
        />
        <p id="secret-hint" class="text-xs text-base-content/80">
          {{ t('secretHint') }}
        </p>
      </div>

      <!-- Mixed-content is the one error that needs the longer remediation copy;
           every other state (unreachable / auth / connecting) rides the status
           readout above. -->
      <div
        v-if="endpointError === 'mixed_content'"
        role="alert"
        class="rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm text-error"
      >
        {{ t('mixedContentError') }}
      </div>

      <Button type="submit" class="w-full btn-primary" :loading="isSubmitting">
        {{ submitLabel }}
      </Button>
    </form>
  </div>
</template>
