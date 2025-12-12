<script setup lang="ts">
import type { Rule, RuleProvider } from '~/types'
import { IconReload } from '@tabler/icons-vue'
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
const configStore = useConfigStore()

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
  estimateSize: () => 80, // Estimated height of each rule card
  overscan: 5, // Render 5 extra items outside visible area
}))
const rulesVirtualizer = useVirtualizer(rulesVirtualizerOptions)

// Virtual scrollers for rule providers
const providersVirtualizerOptions = computed(() => ({
  count: filteredRuleProviders.value.length,
  getScrollElement: () => providersParentRef.value,
  estimateSize: () => 80, // Estimated height of each provider card
  overscan: 5, // Render 5 extra items outside visible area
}))
const providersVirtualizer = useVirtualizer(providersVirtualizerOptions)

// Computed virtual rows
const virtualRules = computed(() => rulesVirtualizer.value.getVirtualItems())
const virtualProviders = computed(() =>
  providersVirtualizer.value.getVirtualItems(),
)

// Total sizes for virtual containers
const rulesTotalSize = computed(() => rulesVirtualizer.value.getTotalSize())
const providersTotalSize = computed(() =>
  providersVirtualizer.value.getTotalSize(),
)
</script>

<template>
  <div class="flex h-full flex-col gap-2 overflow-y-auto">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-1 items-center justify-center">
      <span class="loading loading-lg loading-spinner" />
    </div>

    <template v-else>
      <!-- Tabs and Search -->
      <div class="flex w-full flex-wrap items-center gap-2">
        <div class="tabs-box tabs gap-2 tabs-sm">
          <button
            v-for="tab in tabs"
            :key="tab.type"
            class="tab gap-2 px-2"
            :class="{ 'bg-primary text-neutral!': activeTab === tab.type }"
            @click="activeTab = tab.type"
          >
            <span>{{ tab.name }}</span>
            <div class="badge badge-sm">
              {{ tab.count }}
            </div>
          </button>
        </div>

        <div class="join flex flex-1 items-center">
          <input
            v-model="globalFilter"
            class="input input-sm join-item flex-1 input-primary"
            type="search"
            :placeholder="t('search')"
          />

          <Button
            v-if="activeTab === 'ruleProviders'"
            class="btn join-item btn-sm btn-primary"
            :disabled="allProviderIsUpdating"
            @click="onUpdateAllProvider"
          >
            <IconReload
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
          class="py-8 text-center text-base-content/70"
        >
          {{ t('noRules') }}
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
            v-for="virtualRow in virtualRules"
            :key="`${filteredRules[virtualRow.index].type}-${filteredRules[virtualRow.index].payload}-${filteredRules[virtualRow.index].proxy}`"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }"
          >
            <div class="card mb-2 bg-base-200 p-4 card-sm card-border">
              <div class="flex items-center gap-2">
                <span class="break-all">{{
                  filteredRules[virtualRow.index].payload
                }}</span>
                <div
                  v-if="filteredRules[virtualRow.index].size !== -1"
                  class="badge badge-sm"
                >
                  {{ filteredRules[virtualRow.index].size }}
                </div>
              </div>
              <div class="text-xs text-slate-500">
                {{ filteredRules[virtualRow.index].type }} ::
                {{ filteredRules[virtualRow.index].proxy }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rule Providers List -->
      <div v-else ref="providersParentRef" class="flex-1 overflow-y-auto">
        <div
          v-if="filteredRuleProviders.length === 0"
          class="py-8 text-center text-base-content/70"
        >
          {{ t('noRuleProviders') }}
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
            v-for="virtualRow in virtualProviders"
            :key="`${filteredRuleProviders[virtualRow.index].type}-${filteredRuleProviders[virtualRow.index].name}`"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }"
          >
            <div class="card relative mb-2 bg-base-200 p-4 card-sm card-border">
              <div class="flex items-center gap-2 pr-8">
                <span class="break-all">{{
                  filteredRuleProviders[virtualRow.index].name
                }}</span>
                <div class="badge badge-sm">
                  {{ filteredRuleProviders[virtualRow.index].ruleCount }}
                </div>
              </div>

              <div class="text-xs text-slate-500">
                {{ filteredRuleProviders[virtualRow.index].vehicleType }} /
                {{ filteredRuleProviders[virtualRow.index].behavior }} /
                {{ t('updated') }}
                {{
                  formatTimeFromNow(
                    filteredRuleProviders[virtualRow.index].updatedAt,
                    locale,
                  )
                }}
              </div>

              <Button
                class="absolute top-2 right-2 mr-2 btn-circle h-4 btn-sm"
                :disabled="
                  updatingMap[filteredRuleProviders[virtualRow.index].name]
                "
                @click="
                  onUpdateProvider(filteredRuleProviders[virtualRow.index].name)
                "
              >
                <IconReload
                  :class="{
                    'animate-spin text-success':
                      updatingMap[filteredRuleProviders[virtualRow.index].name],
                  }"
                />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
