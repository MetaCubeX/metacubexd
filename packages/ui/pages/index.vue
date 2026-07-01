<script setup lang="ts">
import { IconLink, IconLock, IconServer, IconSettings } from '@tabler/icons-vue'
import { FALLBACK_BACKEND_URL } from '~/constants'

const { t } = useI18n()

useHead({ title: computed(() => t('home')) })

const endpointStore = useEndpointStore()
const configStore = useConfigStore()
const runtimeConfig = useRuntimeConfig()
const router = useRouter()
const route = useRoute()

const { endpointError, isSubmitting, defaultBackendURL, connect, autoLogin } =
  useConnect()

const formData = reactive({ url: '', secret: '' })

const hasSavedEndpoints = computed(() => endpointStore.endpointList.length > 0)

const currentOrigin = computed(() =>
  typeof window === 'undefined' ? '' : window.location.origin,
)

onMounted(async () => {
  // Mock demos and already-connected users skip the entry entirely.
  if (runtimeConfig.public.mockMode || endpointStore.currentEndpoint) {
    router.replace(`/${configStore.defaultPage || 'overview'}`)
    return
  }
  // First run: honor a ?hostname deep-link, else try the default backend once.
  await autoLogin(route.query as Record<string, any>, formData)
})
</script>

<template>
  <div
    class="flex h-full items-center justify-center overflow-y-auto bg-base-100 p-4"
  >
    <div class="animate-spring-up mx-auto w-full max-w-md">
      <!-- Brand + purpose -->
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-box bg-primary/12 text-primary"
        >
          <IconServer :size="28" />
        </div>
        <h1
          class="text-3xl font-bold tracking-tight text-base-content sm:text-4xl"
        >
          MetaCube<span class="text-primary">XD</span>
        </h1>
        <p class="mt-2 text-[0.9375rem] text-base-content">
          {{ t('connectPrompt') }}
        </p>
      </div>

      <!-- Connect form -->
      <form
        class="flex flex-col gap-5"
        @submit.prevent="connect(formData.url, formData.secret)"
      >
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
            class="w-full rounded-lg border border-base-content/15 bg-base-100 px-4 py-3 text-[0.9375rem] text-base-content transition-colors duration-200 placeholder:text-base-content/70 focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-none"
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
            class="w-full rounded-lg border border-base-content/15 bg-base-100 px-4 py-3 text-[0.9375rem] text-base-content transition-colors duration-200 placeholder:text-base-content/70 focus:border-primary focus:ring-3 focus:ring-primary/20 focus:outline-none"
            placeholder="secret"
            autocomplete="current-password"
          />
        </div>

        <!-- Error Message -->
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

        <Button
          type="submit"
          class="w-full btn-primary"
          :loading="isSubmitting"
        >
          {{ t('connect') }}
        </Button>
      </form>

      <!-- Advanced / saved backends -->
      <div class="mt-6 text-center">
        <NuxtLink
          to="/setup"
          class="inline-flex items-center gap-1.5 text-sm text-base-content/70 no-underline transition-colors hover:text-base-content"
        >
          <IconSettings :size="15" />
          <span>{{
            hasSavedEndpoints ? t('savedEndpoints') : t('setup')
          }}</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
