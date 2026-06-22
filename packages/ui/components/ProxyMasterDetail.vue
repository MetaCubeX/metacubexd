<script setup lang="ts">
import type { Proxy as ProxyType } from '~/types'
import {
  IconBolt,
  IconChevronRight,
  IconRouter,
  IconSearch,
  IconTarget,
  IconWorld,
  IconX,
} from '@tabler/icons-vue'
import {
  filterNodesByCapability,
  filterNodesByRegion,
  filterNodesByType,
  filterProxiesByName,
  formatProxyType,
  getCapabilityFacets,
  getRegionFacets,
  getTypeFacets,
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
const selectedTypes = ref<Set<string>>(new Set())
const filterUdp = ref(false)
const filterXudp = ref(false)

// type/udp/xudp aren't encoded in the node name, so facet/filter helpers read
// them through the store's node read-model.
const metaOf = (name: string) => proxiesStore.getNode(name)

// Facets derive from the (sorted/globally-filtered) group node list, so chip
// counts stay stable as the active filters narrow the displayed list.
const regionFacets = computed(() => getRegionFacets(activeNodes.value))
const typeFacets = computed(() => getTypeFacets(activeNodes.value, metaOf))
const capabilityFacets = computed(() =>
  getCapabilityFacets(activeNodes.value, metaOf),
)

const hasCapability = computed(
  () => capabilityFacets.value.udp > 0 || capabilityFacets.value.xudp > 0,
)
const hasAnyFacet = computed(
  () =>
    regionFacets.value.length > 1 ||
    typeFacets.value.length > 1 ||
    hasCapability.value,
)
const hasActiveFilter = computed(
  () =>
    selectedRegions.value.size > 0 ||
    selectedTypes.value.size > 0 ||
    filterUdp.value ||
    filterXudp.value,
)

const displayNodes = computed(() =>
  filterProxiesByName(
    filterNodesByCapability(
      filterNodesByType(
        filterNodesByRegion(activeNodes.value, selectedRegions.value),
        selectedTypes.value,
        metaOf,
      ),
      { udp: filterUdp.value, xudp: filterXudp.value },
      metaOf,
    ),
    localKeyword.value,
  ),
)

const selectedVisible = computed(
  () =>
    !!activeGroup.value?.now &&
    displayNodes.value.includes(activeGroup.value.now),
)

function toggleInSet(set: Ref<Set<string>>, key: string) {
  const next = new Set(set.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  set.value = next
}
const toggleRegion = (code: string) => toggleInSet(selectedRegions, code)
const toggleType = (type: string) => toggleInSet(selectedTypes, type)

function clearFilters() {
  selectedRegions.value = new Set()
  selectedTypes.value = new Set()
  filterUdp.value = false
  filterXudp.value = false
}

// Shared pill styling for every filter chip (region / protocol / feature).
function chipClass(active: boolean) {
  return [
    'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs transition-all duration-150',
    active
      ? 'border-primary/50 bg-primary/15 text-primary'
      : 'border-base-content/10 bg-base-100/60 text-base-content/60 hover:border-primary/30 hover:text-base-content/80',
  ]
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
  clearFilters()
  nextTick(() => scrollSelectedIntoView('auto'))
})

function aliveCount(group: ProxyType) {
  return proxiesStore.aliveNodeNames(group.all ?? []).length
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
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border border-base-content/8 bg-base-200/40"
    >
      <!-- Sticky header: title + search + jump + region chips.
           z-20 keeps it above a selected node row (its wrapper is z-10 and its
           glow/elevation would otherwise bleed up over the region chips). -->
      <div
        class="sticky top-0 z-20 flex flex-col gap-2 rounded-t-xl border-b border-base-content/8 bg-base-200/95 px-3 pt-3 pb-2 backdrop-blur-sm"
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

        <!-- Quick-filter rail: region · protocol · features, grouped by
             hairline dividers and horizontally scrollable so chips never wrap
             into a blob. Each group renders only when it offers a real choice. -->
        <div v-if="hasAnyFacet" class="flex items-center gap-1.5">
          <div
            class="-mx-0.5 flex flex-1 [scrollbar-width:none] items-center gap-1.5 overflow-x-auto px-0.5 py-px [&::-webkit-scrollbar]:hidden"
          >
            <!-- Region -->
            <template v-if="regionFacets.length > 1">
              <IconWorld
                :size="14"
                class="shrink-0 text-base-content/35"
                aria-hidden="true"
              />
              <button
                type="button"
                :class="chipClass(selectedRegions.size === 0)"
                :aria-pressed="selectedRegions.size === 0"
                @click="selectedRegions = new Set()"
              >
                {{ t('all') }}
              </button>
              <button
                v-for="facet in regionFacets"
                :key="`region-${facet.code}`"
                type="button"
                :class="chipClass(selectedRegions.has(facet.code))"
                :aria-pressed="selectedRegions.has(facet.code)"
                @click="toggleRegion(facet.code)"
              >
                <span>{{ facet.flag || t('regionOther') }}</span>
                <span class="opacity-55">{{ facet.count }}</span>
              </button>
            </template>

            <!-- Protocol -->
            <template v-if="typeFacets.length > 1">
              <span
                v-if="regionFacets.length > 1"
                class="h-3.5 w-px shrink-0 bg-base-content/12"
                aria-hidden="true"
              />
              <IconRouter
                :size="14"
                class="shrink-0 text-base-content/35"
                aria-hidden="true"
              />
              <button
                type="button"
                :class="chipClass(selectedTypes.size === 0)"
                :aria-pressed="selectedTypes.size === 0"
                @click="selectedTypes = new Set()"
              >
                {{ t('all') }}
              </button>
              <button
                v-for="facet in typeFacets"
                :key="`type-${facet.type}`"
                type="button"
                :class="chipClass(selectedTypes.has(facet.type))"
                :aria-pressed="selectedTypes.has(facet.type)"
                @click="toggleType(facet.type)"
              >
                <span>{{ formatProxyType(facet.type, t) }}</span>
                <span class="opacity-55">{{ facet.count }}</span>
              </button>
            </template>

            <!-- Features: UDP / XUDP independent toggles -->
            <template v-if="hasCapability">
              <span
                v-if="regionFacets.length > 1 || typeFacets.length > 1"
                class="h-3.5 w-px shrink-0 bg-base-content/12"
                aria-hidden="true"
              />
              <IconBolt
                :size="14"
                class="shrink-0 text-base-content/35"
                aria-hidden="true"
              />
              <button
                v-if="capabilityFacets.udp > 0"
                type="button"
                :class="chipClass(filterUdp)"
                :aria-pressed="filterUdp"
                @click="filterUdp = !filterUdp"
              >
                <span>{{ t('udp') }}</span>
                <span class="opacity-55">{{ capabilityFacets.udp }}</span>
              </button>
              <button
                v-if="capabilityFacets.xudp > 0"
                type="button"
                :class="chipClass(filterXudp)"
                :aria-pressed="filterXudp"
                @click="filterXudp = !filterXudp"
              >
                <span>XUDP</span>
                <span class="opacity-55">{{ capabilityFacets.xudp }}</span>
              </button>
            </template>
          </div>

          <!-- Clear all active filters; kept out of the scroll area, pinned right -->
          <button
            v-if="hasActiveFilter"
            type="button"
            class="flex shrink-0 items-center rounded-full p-1 text-base-content/40 transition-colors hover:bg-base-content/8 hover:text-base-content"
            :title="t('clearFilters')"
            :aria-label="t('clearFilters')"
            @click="clearFilters"
          >
            <IconX :size="14" />
          </button>
        </div>
      </div>

      <!-- Node list -->
      <div class="flex flex-col gap-2 px-3 pt-2 pb-3">
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
