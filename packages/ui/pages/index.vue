<script setup lang="ts">
import { IconServer, IconSettings } from '@tabler/icons-vue'

const { t } = useI18n()

useHead({ title: computed(() => t('home')) })

const endpointStore = useEndpointStore()
const configStore = useConfigStore()
const runtimeConfig = useRuntimeConfig()
const router = useRouter()
const route = useRoute()

const connectForm = ref<{
  autoLogin: (
    query: Record<string, any>,
    options?: { tryDefault?: boolean },
  ) => Promise<void>
} | null>(null)

const hasSavedEndpoints = computed(() => endpointStore.endpointList.length > 0)

onMounted(async () => {
  // Mock demos and already-connected users skip the entry entirely.
  if (runtimeConfig.public.mockMode || endpointStore.currentEndpoint) {
    router.replace(`/${configStore.defaultPage || 'overview'}`)
    return
  }
  // First run: honor a ?hostname deep-link, else silently probe the default.
  await connectForm.value?.autoLogin(route.query as Record<string, any>)
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
        <p class="mt-2 text-sm text-base-content">
          {{ t('connectPrompt') }}
        </p>
      </div>

      <ConnectForm ref="connectForm" :submit-label="t('connect')" />

      <!-- Advanced / saved backends -->
      <div class="mt-6 text-center">
        <NuxtLink
          to="/setup"
          class="inline-flex items-center gap-1.5 text-sm text-base-content/80 no-underline transition-colors hover:text-base-content"
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
