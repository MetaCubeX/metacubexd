<script setup lang="ts">
import type { Endpoint } from '~/types'
import {
  IconGripVertical,
  IconPencil,
  IconServer,
  IconX,
} from '@tabler/icons-vue'
import { useSortable } from '@vueuse/integrations/useSortable'

definePageMeta({
  layout: 'default',
})

const { t } = useI18n()

useHead({ title: computed(() => t('setup')) })
const route = useRoute()
const endpointStore = useEndpointStore()

const connectForm = ref<{
  autoLogin: (
    query: Record<string, any>,
    options?: { tryDefault?: boolean },
  ) => Promise<void>
  selectEndpoint: (id: string) => Promise<boolean>
} | null>(null)

function onRemove(id: string) {
  endpointStore.removeEndpoint(id)
}

function onLabelInput(id: string, label: string) {
  endpointStore.updateEndpoint(id, { label })
}

// Drag-to-reorder saved endpoints, persisting via the store
const endpointListRef = ref<HTMLElement | null>(null)
const endpointOrder = computed<Endpoint[]>({
  get: () => endpointStore.endpointList,
  set: (list) => endpointStore.setEndpointList(list),
})

useSortable(endpointListRef, endpointOrder, {
  handle: '.drag-handle',
  animation: 150,
  watchElement: true,
})

// Auto-login only honors a ?hostname deep-link here; the default-backend probe
// belongs to the '/' landing entry, so this manager never auto-connects blind.
onMounted(async () => {
  await connectForm.value?.autoLogin(route.query as Record<string, any>, {
    tryDefault: false,
  })
})
</script>

<template>
  <div
    class="flex h-full items-center justify-center overflow-y-auto bg-base-100 p-4"
  >
    <div class="animate-spring-up mx-auto w-full max-w-md">
      <!-- Kernel control (capability-gated; hidden on plain remote setup) -->
      <KernelControlPanel class="mb-6" />
      <KernelVersionPanel class="mb-6" />
      <SystemProxyControlPanel class="mb-6" />

      <!-- Logo Section -->
      <div class="mb-8 text-center">
        <div class="mb-4">
          <div
            class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-box bg-primary/12 text-primary"
          >
            <IconServer :size="32" />
          </div>
          <h1
            class="text-3xl font-bold tracking-wide text-base-content uppercase sm:text-4xl"
          >
            <span>metacube</span>
            <span class="text-base-content/40">(</span>
            <a
              class="text-primary no-underline transition-colors duration-200 hover:text-primary/80"
              href="https://github.com/metacubex/metacubexd"
              target="_blank"
            >
              xd
            </a>
            <span class="text-base-content/40">)</span>
          </h1>
        </div>
        <p class="text-[0.9375rem] text-base-content/80">
          {{ t('setupDescription') }}
        </p>
      </div>

      <!-- Connect form (shared with the '/' landing entry) -->
      <ConnectForm ref="connectForm" :submit-label="t('add')" />

      <!-- Saved Endpoints -->
      <div v-if="endpointStore.endpointList.length > 0" class="mt-6">
        <h3
          class="mb-3 text-[0.8125rem] font-semibold tracking-widest text-base-content/70 uppercase"
        >
          {{ t('savedEndpoints') }}
        </h3>
        <div ref="endpointListRef" class="flex flex-col gap-3">
          <div
            v-for="endpoint in endpointStore.endpointList"
            :key="endpoint.id"
            class="group flex cursor-pointer items-center gap-2 rounded-xl border border-base-content/10 bg-base-200 p-3 transition-colors duration-200 hover:border-base-content/20 hover:bg-base-300"
            @click="connectForm?.selectEndpoint(endpoint.id)"
          >
            <IconGripVertical
              class="drag-handle shrink-0 cursor-grab text-base-content/30 transition-colors duration-200 hover:text-base-content/60 active:cursor-grabbing"
              :size="16"
              @click.stop
            />
            <div
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-base-300 text-base-content/60"
            >
              <IconServer :size="16" />
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <div class="flex items-center gap-1.5">
                <IconPencil
                  class="shrink-0 text-base-content/30 transition-colors duration-200 group-hover:text-base-content/50"
                  :size="12"
                />
                <input
                  :value="endpoint.label"
                  type="text"
                  class="min-w-0 flex-1 border-none bg-transparent p-0 text-[0.8125rem] font-medium text-base-content transition-colors duration-200 placeholder:text-base-content/60 focus:outline-none"
                  :placeholder="endpoint.url"
                  @click.stop
                  @input="
                    onLabelInput(
                      endpoint.id,
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
              </div>
              <span
                v-if="endpoint.label"
                class="overflow-hidden pl-[1.125rem] text-[0.6875rem] text-ellipsis whitespace-nowrap text-base-content/50"
                >{{ endpoint.url }}</span
              >
            </div>
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
