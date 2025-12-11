<script setup lang="ts">
import type { Rule, RuleProvider } from '~/types'
import { IconReload } from '@tabler/icons-vue'
import { matchSorter } from 'match-sorter'
import {
  useRuleProvidersQuery,
  useRulesQuery,
  useUpdateRuleProviderMutation,
} from '~/composables/useQueries'
import { formatTimeFromNow, useStringBooleanMap } from '~/utils'

useHead({ title: 'Rules' })

const { t, locale } = useI18n()
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
</script>

<template>
  <div class="flex h-full flex-col gap-2">
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
        class="flex-1 space-y-2 overflow-y-auto"
      >
        <div
          v-for="rule in filteredRules"
          :key="`${rule.type}-${rule.payload}-${rule.proxy}`"
          class="card bg-base-200 p-4 card-sm card-border"
        >
          <div class="flex items-center gap-2">
            <span class="break-all">{{ rule.payload }}</span>
            <div v-if="rule.size !== -1" class="badge badge-sm">
              {{ rule.size }}
            </div>
          </div>
          <div class="text-xs text-slate-500">
            {{ rule.type }} :: {{ rule.proxy }}
          </div>
        </div>

        <div
          v-if="filteredRules.length === 0"
          class="py-8 text-center text-base-content/70"
        >
          {{ t('noRules') }}
        </div>
      </div>

      <!-- Rule Providers List -->
      <div v-else class="flex-1 space-y-2 overflow-y-auto">
        <div
          v-for="provider in filteredRuleProviders"
          :key="`${provider.type}-${provider.name}`"
          class="card relative bg-base-200 p-4 card-sm card-border"
        >
          <div class="flex items-center gap-2 pr-8">
            <span class="break-all">{{ provider.name }}</span>
            <div class="badge badge-sm">
              {{ provider.ruleCount }}
            </div>
          </div>

          <div class="text-xs text-slate-500">
            {{ provider.vehicleType }} / {{ provider.behavior }} /
            {{ t('updated') }}
            {{ formatTimeFromNow(provider.updatedAt, locale) }}
          </div>

          <Button
            class="absolute top-2 right-2 mr-2 btn-circle h-4 btn-sm"
            :disabled="updatingMap[provider.name]"
            @click="onUpdateProvider(provider.name)"
          >
            <IconReload
              :class="{
                'animate-spin text-success': updatingMap[provider.name],
              }"
            />
          </Button>
        </div>

        <div
          v-if="filteredRuleProviders.length === 0"
          class="py-8 text-center text-base-content/70"
        >
          No rule providers
        </div>
      </div>
    </template>
  </div>
</template>
