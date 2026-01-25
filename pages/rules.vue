<script setup lang="ts">
import type { Rule, RuleProvider } from '~/types'
import { IconFilter, IconReload, IconSearch } from '@tabler/icons-vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { matchSorter } from 'match-sorter'
import {
  useRuleProvidersQuery,
  useRulesQuery,
  useUpdateRuleProviderMutation,
} from '~/composables/useQueries'
import { formatTimeFromNow, useStringBooleanMap } from '~/utils'

const { t, locale } = useI18n()

useHead({ title: computed(() => t('rules')) })

// TanStack Query
const { data: rules = ref([]), isLoading: isLoadingRules } = useRulesQuery()
const { data: ruleProviders = ref([]), isLoading: isLoadingProviders } =
  useRuleProvidersQuery()
const updateProviderMutation = useUpdateRuleProviderMutation()

const activeTab = ref<'rules' | 'ruleProviders'>('rules')
const globalFilter = ref('')

const { map: updatingMap, setWithCallback: setUpdatingMap } =
  useStringBooleanMap()

// Virtual scroll refs
const rulesParentRef = ref<HTMLElement | null>(null)
const providersParentRef = ref<HTMLElement | null>(null)

const tabs = computed(() => [
  {
    type: 'rules' as const,
    name: t('rules'),
    count: rules.value?.length ?? 0,
  },
  {
    type: 'ruleProviders' as const,
    name: t('ruleProviders'),
    count: ruleProviders.value?.length ?? 0,
  },
])

const filteredRules = computed(() =>
  globalFilter.value
    ? matchSorter(rules.value ?? [], globalFilter.value, {
        keys: ['type', 'payload', 'proxy'] as (keyof Rule)[],
      })
    : (rules.value ?? []),
)

const filteredRuleProviders = computed(() =>
  globalFilter.value
    ? matchSorter(ruleProviders.value ?? [], globalFilter.value, {
        keys: ['name', 'vehicleType', 'behavior'] as (keyof RuleProvider)[],
      })
    : (ruleProviders.value ?? []),
)

async function onUpdateProvider(name: string) {
  await setUpdatingMap(name, () => updateProviderMutation.mutateAsync(name))
}

async function onUpdateAllProvider() {
  const providers = ruleProviders.value ?? []
  await Promise.all(
    providers.map((provider) =>
      updateProviderMutation.mutateAsync(provider.name),
    ),
  )
}

const isLoading = computed(
  () => isLoadingRules.value || isLoadingProviders.value,
)
const allProviderIsUpdating = computed(
  () => updateProviderMutation.isPending.value,
)

// Virtual scrollers for rules
const rulesVirtualizerOptions = computed(() => ({
  count: filteredRules.value.length,
  getScrollElement: () => rulesParentRef.value,
  estimateSize: () => 88, // Estimated height of each rule card
  overscan: 5, // Render 5 extra items outside visible area
}))
const rulesVirtualizer = useVirtualizer(rulesVirtualizerOptions)

// Virtual scrollers for rule providers
const providersVirtualizerOptions = computed(() => ({
  count: filteredRuleProviders.value.length,
  getScrollElement: () => providersParentRef.value,
  estimateSize: () => 88, // Estimated height of each provider card
  overscan: 5, // Render 5 extra items outside visible area
}))
const providersVirtualizer = useVirtualizer(providersVirtualizerOptions)

// Computed virtual rows with data
const virtualRulesWithData = computed(() =>
  rulesVirtualizer.value.getVirtualItems().map((virtualRow) => ({
    ...virtualRow,
    data: filteredRules.value[virtualRow.index]!,
  })),
)
const virtualProvidersWithData = computed(() =>
  providersVirtualizer.value.getVirtualItems().map((virtualRow) => ({
    ...virtualRow,
    data: filteredRuleProviders.value[virtualRow.index]!,
  })),
)

// Total sizes for virtual containers
const rulesTotalSize = computed(() => rulesVirtualizer.value.getTotalSize())
const providersTotalSize = computed(() =>
  providersVirtualizer.value.getTotalSize(),
)
</script>

<template>
  <div class="rules-page flex h-full flex-col gap-3 overflow-y-auto p-2">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <span class="loading loading-lg loading-ring text-primary" />
        <span class="text-sm opacity-60">{{ t('rules') }}</span>
      </div>
    </div>

    <template v-else>
      <!-- Header with Tabs and Search -->
      <div class="animate-fade-slide-in flex flex-wrap items-center gap-3">
        <!-- Tabs -->
        <div
          class="flex gap-1 rounded-xl border border-base-content/8 bg-base-200/60 p-1 backdrop-blur-sm"
        >
          <button
            v-for="tab in tabs"
            :key="tab.type"
            class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-base-content/70 transition-all duration-200 hover:bg-base-content/5"
            :class="{
              'bg-primary text-primary-content shadow-[0_2px_8px] shadow-primary/30 hover:bg-primary':
                activeTab === tab.type,
            }"
            @click="activeTab = tab.type"
          >
            <span class="font-medium">{{ tab.name }}</span>
            <span
              class="rounded-md bg-base-content/10 px-1.5 py-0.5 text-xs font-semibold"
              :class="{
                'bg-primary-content/20': activeTab === tab.type,
              }"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>

        <!-- Search and Actions -->
        <div class="flex flex-1 items-center gap-2">
          <div
            class="flex flex-1 items-center gap-2 rounded-lg border border-base-content/8 bg-base-200/60 px-3 py-1.5 transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px] focus-within:shadow-primary/10"
          >
            <IconSearch :size="16" class="opacity-50" />
            <input
              v-model="globalFilter"
              class="w-full bg-transparent text-sm outline-none placeholder:opacity-50"
              type="search"
              :placeholder="t('search')"
            />
          </div>

          <Button
            v-if="activeTab === 'ruleProviders'"
            class="flex h-9 w-9 items-center justify-center rounded-[0.625rem] border border-primary/20 bg-primary/10 text-primary transition-all duration-200 hover:bg-primary/20"
            :disabled="allProviderIsUpdating"
            @click="onUpdateAllProvider"
          >
            <IconReload
              :size="18"
              :class="{ 'animate-spin text-success': allProviderIsUpdating }"
            />
          </Button>
        </div>
      </div>

      <!-- Rules List -->
      <div
        v-if="activeTab === 'rules'"
        ref="rulesParentRef"
        class="flex-1 overflow-y-auto"
      >
        <div
          v-if="filteredRules.length === 0"
          class="animate-fade-in flex flex-col items-center justify-center py-16"
        >
          <IconFilter :size="48" class="mb-4 opacity-20" />
          <span class="text-base-content/50">{{ t('noRules') }}</span>
        </div>
        <div
          v-else
          :style="{
            height: `${rulesTotalSize}px`,
            width: '100%',
            position: 'relative',
          }"
        >
          <div
            v-for="(item, index) in virtualRulesWithData"
            :key="`${item.data.type}-${item.data.payload}-${item.data.proxy}`"
            class="pb-2"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${item.size}px`,
              transform: `translateY(${item.start}px)`,
            }"
          >
            <div
              class="animate-fade-slide-in h-full rounded-xl border border-base-content/8 bg-base-200/60 backdrop-blur-xs transition-all duration-200 hover:border-primary/25 hover:shadow-[0_4px_12px] hover:shadow-primary/8"
              :style="{ animationDelay: `${(index % 10) * 30}ms` }"
            >
              <div class="p-3.5 px-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div
                      class="mb-1 leading-[1.4] font-medium break-all text-base-content"
                    >
                      {{ item.data.payload }}
                    </div>
                    <div
                      class="flex flex-wrap items-center gap-2 text-xs text-base-content/60"
                    >
                      <span
                        class="inline-flex rounded-md bg-primary/15 px-2 py-0.5 font-medium text-primary"
                      >
                        {{ item.data.type }}
                      </span>
                      <span class="opacity-40">-></span>
                      <span
                        class="inline-flex rounded-md bg-secondary/15 px-2 py-0.5 font-medium text-secondary"
                      >
                        {{ item.data.proxy }}
                      </span>
                    </div>
                  </div>
                  <div
                    v-if="item.data.size !== -1"
                    class="inline-flex rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent"
                  >
                    {{ item.data.size }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rule Providers List -->
      <div v-else ref="providersParentRef" class="flex-1 overflow-y-auto">
        <div
          v-if="filteredRuleProviders.length === 0"
          class="animate-fade-in flex flex-col items-center justify-center py-16"
        >
          <IconFilter :size="48" class="mb-4 opacity-20" />
          <span class="text-base-content/50">{{ t('noRuleProviders') }}</span>
        </div>
        <div
          v-else
          :style="{
            height: `${providersTotalSize}px`,
            width: '100%',
            position: 'relative',
          }"
        >
          <div
            v-for="(item, index) in virtualProvidersWithData"
            :key="`${item.data.name}`"
            class="pb-2"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${item.size}px`,
              transform: `translateY(${item.start}px)`,
            }"
          >
            <div
              class="animate-fade-slide-in h-full rounded-xl border border-base-content/8 bg-gradient-to-br from-base-200/60 to-secondary/5 backdrop-blur-xs transition-all duration-200 hover:border-primary/25 hover:shadow-[0_4px_12px] hover:shadow-primary/8"
              :style="{ animationDelay: `${(index % 10) * 30}ms` }"
            >
              <div class="p-3.5 px-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div
                      class="mb-1 leading-[1.4] font-medium break-all text-base-content"
                    >
                      {{ item.data.name }}
                    </div>
                    <div
                      class="flex flex-wrap items-center gap-2 text-xs text-base-content/60"
                    >
                      <span
                        class="inline-flex rounded-md bg-primary/15 px-2 py-0.5 font-medium text-primary"
                      >
                        {{ item.data.vehicleType }}
                      </span>
                      <span class="opacity-40">/</span>
                      <span class="opacity-70">
                        {{ item.data.behavior }}
                      </span>
                      <span class="opacity-40">.</span>
                      <span class="opacity-50">
                        {{ t('updated') }}
                        {{ formatTimeFromNow(item.data.updatedAt, locale) }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <div
                      class="inline-flex rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent"
                    >
                      {{ item.data.ruleCount }}
                    </div>
                    <Button
                      class="flex h-7 w-7 items-center justify-center rounded-lg border border-base-content/8 bg-base-content/5 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary"
                      :disabled="updatingMap[item.data.name]"
                      @click="onUpdateProvider(item.data.name)"
                    >
                      <IconReload
                        :size="16"
                        :class="{
                          'animate-spin text-success':
                            updatingMap[item.data.name],
                        }"
                      />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-fade-slide-in {
  animation: fade-slide-in 0.3s ease-out backwards;
}

.animate-fade-in {
  animation: fade-in 0.4s ease-out;
}
</style>
