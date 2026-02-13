<script setup lang="ts">
import { IconLink, IconLock, IconServer, IconX } from '@tabler/icons-vue'
import { v4 as uuid } from 'uuid'
import { checkEndpointAPI } from '~/composables/useApi'
import { FALLBACK_BACKEND_URL } from '~/constants'
import { transformEndpointURL } from '~/utils'

definePageMeta({
  layout: 'default',
})

const { t } = useI18n()

useHead({ title: computed(() => t('setup')) })
const router = useRouter()
const route = useRoute()
const endpointStore = useEndpointStore()

const formData = reactive({
  url: '',
  secret: '',
})

const isSubmitting = ref(false)

// Get default backend URL from config
// Priority: runtime config (NUXT_PUBLIC_DEFAULT_BACKEND_URL) > config.js > fallback
const runtimeConfig = useRuntimeConfig()
const defaultBackendURL = computed(() => {
  if (runtimeConfig.public.defaultBackendURL) {
    return runtimeConfig.public.defaultBackendURL
  }
  if (
    typeof window !== 'undefined' &&
    (window as any).__METACUBEXD_CONFIG__?.defaultBackendURL
  ) {
    return (window as any).__METACUBEXD_CONFIG__.defaultBackendURL
  }
  return FALLBACK_BACKEND_URL
})

// Get current origin for datalist
const currentOrigin = computed(() => {
  if (typeof window === 'undefined') return ''
  return window.location.origin
})

function onSetupSuccess(id: string) {
  endpointStore.setSelectedEndpoint(id)
  router.replace('/overview')
}

async function onEndpointSelect(id: string) {
  const endpoint = endpointStore.endpointList.find((e) => e.id === id)
  if (!endpoint) return

  if (!(await checkEndpointAPI(endpoint.url, endpoint.secret))) return

  onSetupSuccess(id)
}

async function onSubmit() {
  isSubmitting.value = true

  try {
    const url = formData.url
    const secret = formData.secret
    const transformedURL = transformEndpointURL(url)

    if (!(await checkEndpointAPI(transformedURL, secret))) {
      isSubmitting.value = false
      return
    }

    const id = uuid()
    const list = [...endpointStore.endpointList]
    const point = list.find((history) => history.url === transformedURL)

    if (!point) {
      // New endpoint
      endpointStore.setEndpointList([
        { id, url: transformedURL, secret },
        ...list,
      ])
      onSetupSuccess(id)
      return
    }

    // Update existing endpoint
    point.secret = secret
    point.id = id

    endpointStore.setEndpointList(list)
    onSetupSuccess(id)
  } finally {
    isSubmitting.value = false
  }
}

function onRemove(id: string) {
  endpointStore.removeEndpoint(id)
}

// Auto-login logic
onMounted(async () => {
  const search =
    route.query ||
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null)

  if (search && typeof search === 'object') {
    const hostname = (search as any).hostname
    if (hostname) {
      const protocol = (search as any).http
        ? 'http:'
        : (search as any).https
          ? 'https:'
          : typeof window !== 'undefined'
            ? window.location.protocol
            : 'http:'
      const port = (search as any).port ? `:${(search as any).port}` : ''

      formData.url = `${protocol}//${hostname}${port}`
      formData.secret = (search as any).secret || ''

      await onSubmit()
      return
    }
  }

  // Auto-login with default if no endpoints
  if (endpointStore.endpointList.length === 0) {
    formData.url = defaultBackendURL.value
    formData.secret = ''
    await onSubmit()
  }
})
</script>

<template>
  <div
    class="flex h-full items-center justify-center overflow-y-auto bg-gradient-to-b from-base-100 to-base-200 p-4"
  >
    <div class="animate-fade-slide-in mx-auto w-full max-w-md">
      <!-- Logo Section -->
      <div class="animate-fade-slide-in-delay-1 mb-8 text-center">
        <div class="mb-4">
          <div
            class="shadow-primary-glow mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-content"
          >
            <IconServer :size="32" />
          </div>
          <h1 class="text-3xl font-bold tracking-wide uppercase sm:text-4xl">
            <span
              class="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent"
              >metacube</span
            >
            <span class="text-base-content">(</span>
            <a
              class="inline-block text-primary no-underline transition-all duration-300 hover:scale-110 hover:rotate-5"
              href="https://github.com/metacubex/metacubexd"
              target="_blank"
            >
              xd
            </a>
            <span class="text-base-content">)</span>
          </h1>
        </div>
        <p class="text-[0.9375rem] text-base-content/60">
          {{ t('setupDescription') }}
        </p>
      </div>

      <!-- Form Card -->
      <div
        class="shadow-card animate-fade-slide-in-delay-2 rounded-2xl border border-base-content/8 bg-base-200/80 p-6 backdrop-blur-md"
      >
        <form class="flex flex-col gap-5" @submit.prevent="onSubmit">
          <!-- URL Field -->
          <div class="flex flex-col gap-2">
            <label
              class="flex items-center gap-2 text-sm font-medium text-base-content/70"
              for="url"
            >
              <IconLink :size="16" />
              <span>{{ t('endpointURL') }}</span>
            </label>
            <input
              id="url"
              v-model="formData.url"
              type="url"
              class="w-full rounded-lg border border-base-content/15 bg-base-100/80 px-4 py-3 text-[0.9375rem] text-base-content transition-all duration-200 placeholder:text-base-content/40 focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-none"
              placeholder="http(s)://{hostname}:{port}"
              list="defaultEndpoints"
              autocomplete="on"
            />
            <datalist id="defaultEndpoints">
              <option :value="FALLBACK_BACKEND_URL" />
              <option
                v-if="
                  defaultBackendURL &&
                  defaultBackendURL !== FALLBACK_BACKEND_URL
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

          <!-- Secret Field -->
          <div class="flex flex-col gap-2">
            <label
              class="flex items-center gap-2 text-sm font-medium text-base-content/70"
              for="secret"
            >
              <IconLock :size="16" />
              <span>{{ t('secret') }}</span>
            </label>
            <input
              id="secret"
              v-model="formData.secret"
              type="password"
              class="w-full rounded-lg border border-base-content/15 bg-base-100/80 px-4 py-3 text-[0.9375rem] text-base-content transition-all duration-200 placeholder:text-base-content/40 focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-none"
              placeholder="secret"
              autocomplete="current-password"
            />
          </div>

          <!-- Submit Button -->
          <Button
            type="submit"
            class="hover:shadow-primary-glow-lg w-full cursor-pointer rounded-lg border-none bg-gradient-to-br from-primary to-secondary px-6 py-3.5 text-[0.9375rem] font-semibold tracking-widest text-primary-content uppercase transition-all duration-300 hover:-translate-y-0.5"
            :loading="isSubmitting"
          >
            {{ t('add') }}
          </Button>
        </form>
      </div>

      <!-- Saved Endpoints -->
      <div
        v-if="endpointStore.endpointList.length > 0"
        class="animate-fade-slide-in-delay-3 mt-6"
      >
        <h3
          class="mb-3 text-[0.8125rem] font-semibold tracking-widest text-base-content/50 uppercase"
        >
          Saved Endpoints
        </h3>
        <div class="flex flex-col gap-3">
          <div
            v-for="(endpoint, index) in endpointStore.endpointList"
            :key="endpoint.id"
            class="animate-fade-slide-in flex cursor-pointer items-center gap-2 rounded-xl border border-info/20 bg-info/10 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-info/30 hover:bg-info/15"
            :style="{ animationDelay: `${index * 50}ms` }"
            @click="onEndpointSelect(endpoint.id)"
          >
            <div
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-info/20 text-info"
            >
              <IconServer :size="16" />
            </div>
            <span
              class="min-w-0 flex-1 overflow-hidden text-[0.8125rem] font-medium text-ellipsis whitespace-nowrap text-base-content"
              >{{ endpoint.url }}</span
            >
            <button
              class="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-base-content/50 transition-all duration-200 hover:bg-error/15 hover:text-error"
              @click.stop="onRemove(endpoint.id)"
            >
              <IconX :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom animations that require keyframes */
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-slide-in {
  animation: fadeSlideIn 0.5s ease-out;
}

.animate-fade-slide-in-delay-1 {
  animation: fadeSlideIn 0.5s ease-out 0.1s backwards;
}

.animate-fade-slide-in-delay-2 {
  animation: fadeSlideIn 0.5s ease-out 0.2s backwards;
}

.animate-fade-slide-in-delay-3 {
  animation: fadeSlideIn 0.5s ease-out 0.3s backwards;
}

/* Custom shadows using CSS variables */
.shadow-primary-glow {
  box-shadow: 0 8px 24px
    color-mix(in oklch, var(--color-primary) 30%, transparent);
}

.shadow-primary-glow-lg {
  box-shadow: 0 6px 20px
    color-mix(in oklch, var(--color-primary) 40%, transparent);
}

.shadow-card {
  box-shadow: 0 4px 24px
    color-mix(in oklch, var(--color-base-content) 5%, transparent);
}
</style>
