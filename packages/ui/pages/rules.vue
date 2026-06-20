<script setup lang="ts">
import type { RuleEntry } from '~/composables/useRuleEditor'
import type { RULES_ORDERING_TYPE } from '~/constants'
import type { Rule, RuleProvider } from '~/types'
import {
  IconArrowsSort,
  IconEdit,
  IconFilter,
  IconFilterOff,
  IconGripVertical,
  IconPlus,
  IconReload,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { matchSorter } from 'match-sorter'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  useRuleProvidersQuery,
  useRulesQuery,
  useToggleRuleDisabledMutation,
  useUpdateRuleProviderMutation,
} from '~/composables/useQueries'
import { useRuleEditor } from '~/composables/useRuleEditor'
import { RULES_ORDERING_TYPE_ORDER } from '~/constants'
import {
  filterRules,
  formatTimeFromNow,
  getRuleFacets,
  sortRulesByOrderingType,
  useStringBooleanMap,
} from '~/utils'

const { t, locale } = useI18n()

const configStore = useConfigStore()

useHead({ title: computed(() => t('rules')) })

const sortOptions = computed(() =>
  RULES_ORDERING_TYPE_ORDER.map((order) => ({ value: order, label: t(order) })),
)

// TanStack Query
const {
  data: rules = ref([]),
  isLoading: isLoadingRules,
  refetch: refetchRules,
} = useRulesQuery()
const { data: ruleProviders = ref([]), isLoading: isLoadingProviders } =
  useRuleProvidersQuery()
const updateProviderMutation = useUpdateRuleProviderMutation()
const toggleRuleDisabledMutation = useToggleRuleDisabledMutation()

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

// Chip lists derived from the UNFILTERED rules so counts stay stable as the
// user toggles filters.
const ruleTypeFacets = computed(() => getRuleFacets(rules.value ?? [], 'type'))
const rulePolicyFacets = computed(() =>
  getRuleFacets(rules.value ?? [], 'proxy'),
)

const filteredRules = computed(() => {
  // 1. structured filter (chips + status) — always applied first so the search
  //    and sort below operate on the narrowed set.
  const filtered = filterRules(rules.value ?? [], {
    types: configStore.rulesTypeFilter,
    policies: configStore.rulesPolicyFilter,
    status: configStore.rulesStatusFilter,
  })

  // 2. global search owns ordering (relevance ranking) — short-circuit sort
  //    while the user is hunting.
  if (globalFilter.value) {
    return matchSorter(filtered, globalFilter.value, {
      keys: ['type', 'payload', 'proxy'] as (keyof Rule)[],
    })
  }

  // 3. no search -> explicit sort
  return sortRulesByOrderingType(filtered, configStore.rulesOrderingType)
})

const hasActiveRuleFilters = computed(
  () =>
    configStore.rulesTypeFilter.length > 0 ||
    configStore.rulesPolicyFilter.length > 0 ||
    configStore.rulesStatusFilter !== 'all' ||
    !!globalFilter.value,
)

function toggleRuleTypeFilter(value: string) {
  const arr = configStore.rulesTypeFilter
  configStore.rulesTypeFilter = arr.includes(value)
    ? arr.filter((v) => v !== value)
    : [...arr, value]
}

function toggleRulePolicyFilter(value: string) {
  const arr = configStore.rulesPolicyFilter
  configStore.rulesPolicyFilter = arr.includes(value)
    ? arr.filter((v) => v !== value)
    : [...arr, value]
}

function clearRuleFilters() {
  configStore.resetRulesFilters()
  globalFilter.value = ''
}

// Reorder/shrink of the filtered list can leave the scroll offset past the new
// end (blank viewport) — reset to top whenever the result set changes.
watch(
  () => [
    configStore.rulesOrderingType,
    configStore.rulesTypeFilter,
    configStore.rulesPolicyFilter,
    configStore.rulesStatusFilter,
    globalFilter.value,
  ],
  () => rulesParentRef.value?.scrollTo({ top: 0 }),
)

const filteredRuleProviders = computed(() =>
  globalFilter.value
    ? matchSorter(ruleProviders.value ?? [], globalFilter.value, {
        keys: ['name', 'vehicleType', 'behavior'] as (keyof RuleProvider)[],
      })
    : (ruleProviders.value ?? []),
)

async function onToggleRuleDisabled(rule: Rule) {
  await setUpdatingMap(`rule-${rule.index}`, () =>
    toggleRuleDisabledMutation.mutateAsync({
      index: rule.index,
      disabled: !rule.extra?.disabled,
    }),
  )
}

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

// ---- GUI rule editor (desktop, gated on the config-sections feature) -------
// Additive: the read-only list above (hit counts etc.) is untouched. Local
// edits are batched and persisted with a SINGLE PUT so the kernel restarts once.
const ruleEditor = useRuleEditor()
const editorModalRef = ref<{ open: () => void; close: () => void }>()
const editorSaving = ref(false)
const dragIndex = ref<number | null>(null)

async function openRuleEditor() {
  await ruleEditor.load()
  editorModalRef.value?.open()
}

function addRuleEntry() {
  ruleEditor.add({ type: '', payload: '', policy: '' })
}

function updateRuleField(
  index: number,
  field: keyof Pick<RuleEntry, 'type' | 'payload' | 'policy'>,
  value: string,
) {
  const current = ruleEditor.rules.value[index]
  if (!current) return
  ruleEditor.update(index, { ...current, [field]: value })
}

function onRuleDragStart(index: number) {
  dragIndex.value = index
}

function onRuleDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = null
  if (from === null || from === index) return
  ruleEditor.move(from, index)
}

async function saveRuleEditor() {
  editorSaving.value = true
  try {
    const ok = await ruleEditor.save()
    if (!ok) return
    toast.success(t('rulesEditorSaved'))
    editorModalRef.value?.close()
    // Kernel restarted with the new rules — refresh the read-only view.
    await refetchRules()
  } finally {
    editorSaving.value = false
  }
}
</script>

<template>
  <div class="rules-page flex h-full flex-col gap-3 overflow-y-auto">
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
            v-if="activeTab === 'rules' && ruleEditor.available.value"
            class="flex h-9 w-9 items-center justify-center rounded-[0.625rem] border border-primary/20 bg-primary/10 text-primary transition-all duration-200 hover:bg-primary/20"
            :title="t('editRules')"
            @click="openRuleEditor"
          >
            <IconEdit :size="16" />
          </Button>

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

      <!-- Rules filter + sort toolbar (rules tab only) -->
      <div
        v-if="activeTab === 'rules'"
        class="animate-fade-slide-in flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center"
      >
        <!-- Status segmented control (mutually exclusive) -->
        <div
          class="flex shrink-0 gap-1 rounded-xl border border-base-content/8 bg-base-200/60 p-1"
        >
          <button
            v-for="opt in ['all', 'enabled', 'disabled'] as const"
            :key="opt"
            class="rounded-lg px-2.5 py-1 text-xs font-medium text-base-content/70 transition-all duration-200 hover:bg-base-content/5"
            :class="{
              'bg-primary text-primary-content shadow-[0_2px_8px] shadow-primary/30':
                configStore.rulesStatusFilter === opt,
            }"
            @click="configStore.rulesStatusFilter = opt"
          >
            {{ t(opt) }}
          </button>
        </div>

        <!-- Chip strip: type chips | divider | policy chips (horizontal scroll) -->
        <div
          class="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          <button
            v-for="facet in ruleTypeFacets"
            :key="`t-${facet.value}`"
            class="shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-200"
            :class="
              configStore.rulesTypeFilter.includes(facet.value)
                ? 'border-primary/30 bg-primary/15 text-primary'
                : 'border-base-content/8 bg-base-200/60 text-base-content/70 hover:border-primary/25 hover:text-base-content'
            "
            @click="toggleRuleTypeFilter(facet.value)"
          >
            {{ facet.value }}
            <span class="ml-1 opacity-60">{{ facet.count }}</span>
          </button>

          <span
            v-if="ruleTypeFacets.length && rulePolicyFacets.length"
            class="mx-1 h-4 w-px shrink-0 bg-base-content/10"
          />

          <button
            v-for="facet in rulePolicyFacets"
            :key="`p-${facet.value}`"
            class="shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-200"
            :class="
              configStore.rulesPolicyFilter.includes(facet.value)
                ? 'border-secondary/30 bg-secondary/15 text-secondary'
                : 'border-base-content/8 bg-base-200/60 text-base-content/70 hover:border-secondary/25 hover:text-base-content'
            "
            @click="toggleRulePolicyFilter(facet.value)"
          >
            {{ facet.value }}
            <span class="ml-1 opacity-60">{{ facet.count }}</span>
          </button>
        </div>

        <!-- Clear (only when something is active) -->
        <Button
          v-if="hasActiveRuleFilters"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-base-content/8 bg-base-content/5 text-base-content/60 transition-colors duration-200 hover:border-error/30 hover:bg-error/10 hover:text-error"
          :title="t('clearFilters')"
          @click="clearRuleFilters"
        >
          <IconX :size="14" />
        </Button>

        <!-- Sort dropdown (icon-only, mirrors the proxies toolbar). Disabled
             while searching, since match-sorter relevance owns the ordering
             then — otherwise the control would silently no-op. -->
        <IconMenuSelect
          :icon="IconArrowsSort"
          :title="globalFilter ? t('sortOverriddenBySearch') : t('sortBy')"
          :options="sortOptions"
          :model-value="configStore.rulesOrderingType"
          :disabled="!!globalFilter"
          @update:model-value="
            (v: string) =>
              (configStore.rulesOrderingType = v as RULES_ORDERING_TYPE)
          "
        />
      </div>

      <!-- Rules List -->
      <template v-if="activeTab === 'rules'">
        <div ref="rulesParentRef" class="flex-1 overflow-y-auto">
          <div
            v-if="filteredRules.length === 0"
            class="animate-fade-in flex flex-col items-center justify-center py-16"
          >
            <template v-if="(rules?.length ?? 0) > 0">
              <IconFilterOff :size="48" class="mb-4 opacity-20" />
              <span class="text-base-content/50">
                {{ t('noMatchingRules') }}
              </span>
              <Button
                class="mt-4 flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm text-primary transition-all duration-200 hover:bg-primary/20"
                @click="clearRuleFilters"
              >
                <IconX :size="16" />
                {{ t('clearFilters') }}
              </Button>
            </template>
            <template v-else>
              <IconFilter :size="48" class="mb-4 opacity-20" />
              <span class="text-base-content/50">{{ t('noRules') }}</span>
            </template>
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
              :key="item.data.index"
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
                <div
                  class="flex h-full flex-col justify-center gap-1.5 px-4 py-2.5"
                >
                  <div
                    class="truncate leading-[1.35] font-medium text-base-content"
                  >
                    {{ item.data.payload || item.data.type }}
                  </div>

                  <div class="flex items-center gap-3 overflow-hidden">
                    <input
                      :checked="!item.data.extra?.disabled"
                      class="toggle shrink-0 toggle-primary toggle-sm"
                      type="checkbox"
                      :disabled="updatingMap[`rule-${item.data.index}`]"
                      @change="onToggleRuleDisabled(item.data)"
                    />

                    <div
                      class="min-w-0 flex-1 overflow-hidden text-xs text-base-content/60"
                    >
                      <div
                        class="flex min-w-0 items-center gap-2 whitespace-nowrap"
                      >
                        <span
                          class="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 font-medium text-primary"
                        >
                          {{ item.data.type }}
                        </span>
                        <span class="shrink-0 opacity-40">-></span>
                        <span
                          class="max-w-32 shrink-0 truncate rounded-md bg-secondary/15 px-2 py-0.5 font-medium text-secondary sm:max-w-none"
                        >
                          {{ item.data.proxy }}
                        </span>
                        <span
                          class="shrink-0 rounded-md bg-success/10 px-2 py-0.5 font-medium text-success"
                        >
                          {{ item.data.extra?.hitCount ?? 0 }}
                        </span>
                        <span
                          class="shrink-0 rounded-md bg-warning/10 px-2 py-0.5 font-medium text-warning"
                        >
                          {{ item.data.extra?.missCount ?? 0 }}
                        </span>
                        <span
                          v-if="item.data.extra?.hitAt"
                          class="hidden shrink-0 text-[11px] text-base-content/50 md:inline"
                          :title="`${t('lastMatchedAt')} ${formatTimeFromNow(item.data.extra.hitAt, locale)}`"
                        >
                          {{ t('lastMatchedAt') }}
                          {{ formatTimeFromNow(item.data.extra.hitAt, locale) }}
                        </span>
                        <span
                          v-if="item.data.extra?.missAt"
                          class="hidden shrink-0 text-[11px] text-base-content/45 lg:inline"
                          :title="`${t('lastUnmatchedAt')} ${formatTimeFromNow(item.data.extra.missAt, locale)}`"
                        >
                          {{ t('lastUnmatchedAt') }}
                          {{
                            formatTimeFromNow(item.data.extra.missAt, locale)
                          }}
                        </span>
                      </div>
                    </div>

                    <div
                      v-if="item.data.size !== -1"
                      class="hidden shrink-0 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent sm:inline-flex"
                    >
                      {{ item.data.size }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

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
              class="animate-fade-slide-in h-full rounded-xl border border-base-content/8 bg-linear-to-br from-base-200/60 to-secondary/5 backdrop-blur-xs transition-all duration-200 hover:border-primary/25 hover:shadow-[0_4px_12px] hover:shadow-primary/8"
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

    <!-- GUI rule editor modal (desktop, config-sections feature). Additive — the
         read-only list above is unchanged. -->
    <Modal
      v-if="ruleEditor.available.value"
      ref="editorModalRef"
      :title="t('editRules')"
    >
      <template #icon>
        <IconEdit :size="20" />
      </template>

      <div class="flex flex-col gap-2">
        <p class="text-xs text-base-content/60">
          {{ t('rulesEditorHint') }}
        </p>

        <!-- Column headers -->
        <div
          class="grid grid-cols-[auto_1fr_1.4fr_1fr_auto] items-center gap-2 px-1 text-xs font-medium text-base-content/50"
        >
          <span class="w-4" />
          <span>{{ t('type') }}</span>
          <span>{{ t('payload') }}</span>
          <span>{{ t('policy') }}</span>
          <span class="w-7" />
        </div>

        <!-- Editable rows (draggable to reorder) -->
        <div
          v-for="(entry, index) in ruleEditor.rules.value"
          :key="index"
          class="grid grid-cols-[auto_1fr_1.4fr_1fr_auto] items-center gap-2 rounded-lg border border-base-content/8 bg-base-200/50 p-1.5"
          :class="{ 'opacity-50': dragIndex === index }"
          draggable="true"
          @dragstart="onRuleDragStart(index)"
          @dragover.prevent
          @drop="onRuleDrop(index)"
          @dragend="dragIndex = null"
        >
          <span class="cursor-grab text-base-content/40" :title="t('reorder')">
            <IconGripVertical :size="16" />
          </span>
          <input
            :value="entry.type"
            class="input-bordered input input-sm w-full rounded-md text-xs"
            :placeholder="t('type')"
            @input="
              updateRuleField(
                index,
                'type',
                ($event.target as HTMLInputElement).value,
              )
            "
          />
          <input
            :value="entry.payload"
            class="input-bordered input input-sm w-full rounded-md text-xs"
            :placeholder="t('payload')"
            @input="
              updateRuleField(
                index,
                'payload',
                ($event.target as HTMLInputElement).value,
              )
            "
          />
          <input
            :value="entry.policy"
            class="input-bordered input input-sm w-full rounded-md text-xs"
            :placeholder="t('policy')"
            @input="
              updateRuleField(
                index,
                'policy',
                ($event.target as HTMLInputElement).value,
              )
            "
          />
          <Button
            class="flex h-7 w-7 items-center justify-center rounded-md text-base-content/50 transition-colors hover:bg-error/15 hover:text-error"
            :title="t('delete')"
            @click="ruleEditor.remove(index)"
          >
            <IconTrash :size="16" />
          </Button>
        </div>

        <div
          v-if="ruleEditor.rules.value.length === 0"
          class="py-6 text-center text-sm text-base-content/40"
        >
          {{ t('noRules') }}
        </div>

        <Button
          class="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/30 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
          @click="addRuleEntry"
        >
          <IconPlus :size="16" />
          {{ t('add') }}
        </Button>
      </div>

      <template #actions>
        <Button
          class="rounded-lg border border-base-content/10 px-4 py-1.5 text-sm text-base-content/70 transition-colors hover:bg-base-content/5"
          :disabled="editorSaving"
          @click="editorModalRef?.close()"
        >
          {{ t('cancel') }}
        </Button>
        <Button
          class="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-content transition-colors hover:bg-primary/90 disabled:opacity-50"
          :disabled="editorSaving"
          @click="saveRuleEditor"
        >
          <span
            v-if="editorSaving"
            class="loading mr-1 loading-xs loading-spinner"
          />
          {{ t('save') }}
        </Button>
      </template>
    </Modal>
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
