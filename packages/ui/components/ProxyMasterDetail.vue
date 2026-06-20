<script setup lang="ts">
import type { Proxy as ProxyType } from '~/types'
import {
  IconChevronRight,
  IconSearch,
  IconTarget,
  IconX,
} from '@tabler/icons-vue'
import {
  filterNodesByRegion,
  filterProxiesByName,
  formatProxyType,
  getRegionFacets,
  resolveActiveGroup,
} from '~/utils'

interface Props {
  groups: ProxyType[]
  sortedNamesByGroup: Record<string, string[]>
}

const props = defineProps<Props>()

const proxiesStore = useProxiesStore()
const { t } = useI18n()

const groupNames = computed(() => props.groups.map((g) => g.name))

const activeName = ref<string | null>(null)
// Keep active valid as the group list changes (e.g. on refetch).
watchEffect(() => {
  activeName.value = resolveActiveGroup(groupNames.value, activeName.value)
})

const activeGroup = computed(
  () => props.groups.find((g) => g.name === activeName.value) ?? null,
)
const activeNodes = computed(() =>
  activeGroup.value
    ? props.sortedNamesByGroup[activeGroup.value.name] || []
    : [],
)

// --- Local workbench state (scoped to the active group; reset on switch) ---
const localKeyword = ref('')
const selectedRegions = ref<Set<string>>(new Set())

// Region facets derived from the (sorted/globally-filtered) group node list, so
// chip counts stay stable as region/keyword filters narrow the displayed list.
const regionFacets = computed(() => getRegionFacets(activeNodes.value))

const displayNodes = computed(() =>
  filterProxiesByName(
    filterNodesByRegion(activeNodes.value, selectedRegions.value),
    localKeyword.value,
  ),
)

const selectedVisible = computed(
  () =>
    !!activeGroup.value?.now &&
    displayNodes.value.includes(activeGroup.value.now),
)

function toggleRegion(code: string) {
  const next = new Set(selectedRegions.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  selectedRegions.value = next
}

// Scroll container for the right detail; the selected row carries
// data-selected="true" (a fallthrough attr on ProxyNodeListItem's root).
const detailEl = ref<HTMLElement | null>(null)
function scrollSelectedIntoView(behavior: ScrollBehavior = 'smooth') {
  detailEl.value
    ?.querySelector('[data-selected="true"]')
    ?.scrollIntoView({ block: 'center', behavior })
}

// On group switch: reset local filters and reveal the selected node.
watch(activeName, () => {
  localKeyword.value = ''
  selectedRegions.value = new Set()
  nextTick(() => scrollSelectedIntoView('auto'))
})

function aliveCount(group: ProxyType) {
  return (
    group.all?.filter((n) => proxiesStore.proxyNodeMap[n]?.alive === true)
      .length ?? 0
  )
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 sm:flex-row">
    <!-- Group navigation: horizontal strip on mobile, left rail on >=sm -->
    <div
      class="flex shrink-0 gap-1 overflow-x-auto pb-1 sm:w-48 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:pb-0"
    >
      <button
        v-for="group in groups"
        :key="group.name"
        type="button"
        class="flex w-36 shrink-0 flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 sm:w-auto sm:shrink"
        :class="
          group.name === activeName
            ? 'border-primary/55 bg-primary/12 text-base-content'
            : 'border-base-content/8 bg-base-200/60 text-base-content/70 hover:border-primary/30 hover:bg-primary/8'
        "
        @click="activeName = group.name"
      >
        <span class="flex items-center justify-between gap-2">
          <span class="truncate text-sm font-semibold">{{ group.name }}</span>
          <span class="shrink-0 text-[0.7rem] text-base-content/50">
            {{ aliveCount(group) }}/{{ group.all?.length ?? 0 }}
          </span>
        </span>
        <span class="hidden truncate text-xs text-base-content/45 sm:block">{{
          group.now
        }}</span>
      </button>
    </div>

    <!-- Right detail: active group's nodes + workbench bar -->
    <div
      v-if="activeGroup"
      ref="detailEl"
      class="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-base-content/8 bg-base-200/40 p-3"
    >
      <!-- Sticky header: title + search + jump + region chips -->
      <div
        class="sticky top-0 z-10 -mx-3 -mt-3 mb-1 flex flex-col gap-2 border-b border-base-content/8 bg-base-200/95 px-3 pt-3 pb-2 backdrop-blur-sm"
      >
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold text-base-content">{{
            activeGroup.name
          }}</span>
          <span
            class="badge inline-flex items-center gap-1 badge-sm badge-primary"
          >
            <span class="font-bold">{{
              formatProxyType(activeGroup.type, t)
            }}</span>
            <template v-if="activeGroup.now?.length">
              <IconChevronRight :size="16" />
              <span class="whitespace-nowrap">{{ activeGroup.now }}</span>
            </template>
          </span>
        </div>

        <!-- Inline search (local to this group) + jump-to-current -->
        <div class="flex items-center gap-2">
          <div
            class="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-base-content/10 bg-base-100/60 px-2.5 transition-all duration-200 focus-within:border-primary/40"
          >
            <IconSearch :size="15" class="shrink-0 opacity-50" />
            <input
              v-model="localKeyword"
              type="search"
              class="w-full bg-transparent text-sm outline-none placeholder:opacity-50"
              :placeholder="t('search')"
              :aria-label="t('search')"
            />
            <span class="shrink-0 text-xs text-base-content/45">
              {{ displayNodes.length }}/{{ activeNodes.length }}
            </span>
            <button
              v-if="localKeyword"
              type="button"
              class="shrink-0 text-base-content/45 transition-colors hover:text-base-content"
              :title="t('clear')"
              @click="localKeyword = ''"
            >
              <IconX :size="14" />
            </button>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-base-content/10 bg-base-100/60 text-base-content/70 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!selectedVisible"
            :title="t('jumpToCurrent')"
            :aria-label="t('jumpToCurrent')"
            @click="scrollSelectedIntoView()"
          >
            <IconTarget :size="18" />
          </button>
        </div>

        <!-- Region quick-filter chips (only when >1 region present) -->
        <div v-if="regionFacets.length > 1" class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all duration-150"
            :class="
              selectedRegions.size === 0
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-base-content/10 bg-base-100/60 text-base-content/60 hover:border-primary/30'
            "
            :aria-pressed="selectedRegions.size === 0"
            @click="selectedRegions = new Set()"
          >
            {{ t('all') }}
            <span class="opacity-60">{{ activeNodes.length }}</span>
          </button>
          <button
            v-for="facet in regionFacets"
            :key="facet.code"
            type="button"
            class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all duration-150"
            :class="
              selectedRegions.has(facet.code)
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-base-content/10 bg-base-100/60 text-base-content/60 hover:border-primary/30'
            "
            :aria-pressed="selectedRegions.has(facet.code)"
            @click="toggleRegion(facet.code)"
          >
            <span>{{ facet.flag || t('regionOther') }}</span>
            <span class="opacity-60">{{ facet.count }}</span>
          </button>
        </div>
      </div>

      <!-- Node list -->
      <div class="flex flex-col gap-2">
        <ProxyNodeListItem
          v-for="name in displayNodes"
          :key="name"
          :proxy-name="name"
          :test-url="activeGroup.testUrl || null"
          :timeout="activeGroup.timeout ?? null"
          :is-selected="activeGroup.now === name"
          :data-selected="activeGroup.now === name ? 'true' : undefined"
          @click="proxiesStore.selectProxyInGroup(activeGroup, name)"
        />
        <div
          v-if="displayNodes.length === 0"
          class="py-8 text-center text-sm text-base-content/40"
        >
          {{ t('noData') }}
        </div>
      </div>
    </div>
  </div>
</template>
