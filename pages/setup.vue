<script setup lang="ts">
import { IconX } from '@tabler/icons-vue'
import { v4 as uuid } from 'uuid'
import { checkEndpointAPI } from '~/composables/useApi'
import { FALLBACK_BACKEND_URL } from '~/constants'
import { transformEndpointURL } from '~/utils'

useHead({ title: 'Setup' })

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const endpointStore = useEndpointStore()

const formData = reactive({
  url: '',
  secret: '',
})

const isSubmitting = ref(false)

// Get default backend URL from config
const defaultBackendURL = computed(() => {
  if (typeof window === 'undefined') return ''
  return (
    (window as any).__METACUBEXD_CONFIG__?.defaultBackendURL ||
    FALLBACK_BACKEND_URL
  )
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
  <div class="mx-auto flex max-w-screen-sm flex-col items-center gap-4 py-10">
    <form class="contents" @submit.prevent="onSubmit">
      <div class="flex w-full flex-col gap-4">
        <fieldset class="fieldset">
          <label class="label" for="url">
            <span>{{ t('endpointURL') }}</span>
          </label>

          <input
            id="url"
            v-model="formData.url"
            type="url"
            class="input w-full"
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
              v-if="
                typeof window !== 'undefined' &&
                window.location.origin !== FALLBACK_BACKEND_URL
              "
              :value="
                typeof window !== 'undefined' ? window.location.origin : ''
              "
            />
            <option
              v-for="endpoint in endpointStore.endpointList"
              :key="endpoint.id"
              :value="endpoint.url"
            />
          </datalist>
        </fieldset>

        <!-- Hidden username field for password managers -->
        <input
          type="text"
          name="username"
          autocomplete="username"
          class="hidden"
          aria-hidden="true"
          tabindex="-1"
        />

        <fieldset class="fieldset">
          <label class="label" for="secret">
            <span>{{ t('secret') }}</span>
          </label>

          <input
            id="secret"
            v-model="formData.secret"
            type="password"
            class="input w-full"
            placeholder="secret"
            autocomplete="current-password"
          />
        </fieldset>

        <Button
          type="submit"
          class="uppercase btn-primary"
          :loading="isSubmitting"
        >
          {{ t('add') }}
        </Button>
      </div>
    </form>

    <div class="grid w-full grid-cols-2 gap-4">
      <div
        v-for="endpoint in endpointStore.endpointList"
        :key="endpoint.id"
        class="badge flex w-full cursor-pointer items-center justify-between gap-4 py-4 badge-info"
        @click="onEndpointSelect(endpoint.id)"
      >
        <span class="truncate">{{ endpoint.url }}</span>

        <Button
          class="btn-circle text-white btn-ghost btn-xs"
          @click.stop="onRemove(endpoint.id)"
        >
          <IconX />
        </Button>
      </div>
    </div>
  </div>
</template>
