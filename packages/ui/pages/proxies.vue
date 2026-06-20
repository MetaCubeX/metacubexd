<script setup lang="ts">
import type {
  ProxyNodeWithProvider,
  ProxyProvider,
  Proxy as ProxyType,
} from '~/types'
import {
  IconActivity,
  IconBrandSpeedtest,
  IconChevronRight,
  IconChevronsDown,
  IconChevronsUp,
  IconGlobe,
  IconPinnedOff,
  IconReload,
  IconSearch,
  IconSettings,
  IconWand,
  IconX,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import Button from '~/components/Button.vue'
import ConnectivityBoard from '~/components/ConnectivityBoard.vue'
import ProxyNodeCard from '~/components/ProxyNodeCard.vue'
import ProxyNodeChip from '~/components/ProxyNodeChip.vue'
import ProxyNodeListItem from '~/components/ProxyNodeListItem.vue'
import ProxyNodePreview from '~/components/ProxyNodePreview.vue'
import ProxyNodeTableRow from '~/components/ProxyNodeTableRow.vue'
import SubscriptionInfo from '~/components/SubscriptionInfo.vue'
import { useBatchLatencyTest } from '~/composables/useBatchLatencyTest'
import { PROXIES_DISPLAY_MODE } from '~/constants'
import {
  encodeSvg,
  filterProxiesByAvailability,
  filterProxiesByName,
  formatProxyType,
  formatTimeFromNow,
  sortProxiesByOrderingType,
} from '~/utils'
import { findRecommendedNode } from '~/utils/nodeScoring'

const { t, locale } = useI18n()

useHead({ title: computed(() => t('proxies')) })
const proxiesStore = useProxiesStore()
const connectionsStore = useConnectionsStore()
const configStore = useConfigStore()
const nodeRecommendationStore = useNodeRecommendationStore()

// Batch latency test
const {
  isRunning: isBatchTesting,
  testMultipleGroups,
  healthCheckAllProviders,
} = useBatchLatencyTest()

const activeTab = ref<'proxies' | 'proxyProviders'>('proxies')
const settingsModal = ref<{ open: () => void; close: () => void }>()
const connectivityModal = ref<{ open: () => void; close: () => void }>()
const proxyGroupsWrapper = ref<{ isTwoColumns: boolean }>()
const providersWrapper = ref<{ isTwoColumns: boolean }>()

// Progressive rendering: only mount a window of nodes per group, growing as the
// user scrolls near the bottom. Avoids mounting hundreds of cards in one frame
// when a large group is expanded (the main cause of jank with many nodes).
const PROXIES_INITIAL_RENDER_COUNT = 50
const PROXIES_RENDER_STEP = 50
const proxiesScrollEl = ref<HTMLElement | null>(null)
const providersScrollEl = ref<HTMLElement | null>(null)

const formatBytes = (bytes: number) => byteSize(bytes).toString()

// Get recommended node for a proxy group
const getRecommendedNode = (proxyGroup: ProxyType) => {
  const nodeNames = proxyGroup.all ?? []
  return findRecommendedNode(
    nodeNames,
    nodeRecommendationStore.performanceData,
    nodeRecommendationStore.excludedNodes,
    nodeRecommendationStore.scoringWeights,
  )
}

// Test all proxy groups
const testAllGroups = async () => {
  const groupNames = renderProxies.value.map((p) => p.name)
  await testMultipleGroups(groupNames)
  autoSwitchAfterTest(renderProxies.value)
}

// Switch to recommended node in a group. No-op when there is no better node
// than the one already selected — avoids needlessly pinning an automatic
// (url-test/fallback) group to its current node.
const switchToRecommended = (proxyGroup: ProxyType) => {
  const recommended = getRecommendedNode(proxyGroup)
  if (recommended && recommended !== proxyGroup.now) {
    proxiesStore.selectProxyInGroup(proxyGroup, recommended)
  }
}

// Honor the "auto switch to recommended" setting (#1971): once a latency test
// has refreshed the performance data, move the tested group(s) to their
// recommended node. Does nothing unless the user enabled the toggle.
const autoSwitchAfterTest = (proxyGroups: ProxyType[]) => {
  if (!nodeRecommendationStore.autoSwitchEnabled) return
  // A member that is itself a group (selector/url-test/…) must never be
  // auto-selected: picking a nested group by its transitive latency silently
  // overrides the user's manual select-group choice (#2040 — a `select` group
  // jumping to a sub-group on test). Matches clash-verge-rev: a test never
  // reselects. The explicit "Switch to Recommended" button still allows it.
  const groupNames = new Set(proxiesStore.proxies.map((group) => group.name))
  for (const proxyGroup of proxyGroups) {
    const recommended = getRecommendedNode(proxyGroup)
    if (!recommended || recommended === proxyGroup.now) continue
    if (groupNames.has(recommended)) continue
    proxiesStore.selectProxyInGroup(proxyGroup, recommended)
  }
}

const renderProxies = computed(() =>
  proxiesStore.proxies.filter((proxy) => !proxy.hidden),
)

// Whether any rendered proxy group is currently expanded. Drives the
// collapse/expand-all toggle: if any group is open we offer "collapse all",
// otherwise "expand all". (collapsedMap[name] === true means expanded.)
const anyGroupExpanded = computed(() =>
  renderProxies.value.some((proxy) => proxiesStore.collapsedMap[proxy.name]),
)

const toggleAllGroups = () => {
  const expand = !anyGroupExpanded.value
  for (const proxyGroup of renderProxies.value) {
    proxiesStore.collapsedMap[proxyGroup.name] = expand
  }
}

const tabs = computed(() => [
  {
    type: 'proxies' as const,
    name: t('proxies'),
    count: renderProxies.value.length,
  },
  {
    type: 'proxyProviders' as const,
    name: t('proxyProviders'),
    count: proxiesStore.proxyProviders.length,
  },
])

function getSortedProxyNames(proxyGroup: ProxyType) {
  const orderingType = configStore.proxiesOrderingType
  const sorted = sortProxiesByOrderingType({
    proxyNames: proxyGroup.all ?? [],
    orderingType,
    testUrl: proxyGroup.testUrl || null,
    getLatencyByName: proxiesStore.getLatencyByName,
    isProxyGroup: proxiesStore.isProxyGroup,
    latencyQualityMap: configStore.latencyQualityMap,
    urlForLatencyTest: configStore.urlForLatencyTest,
    performanceData: nodeRecommendationStore.performanceData,
  })

  const available = filterProxiesByAvailability({
    proxyNames: sorted,
    enabled: configStore.hideUnAvailableProxies,
    testUrl: proxyGroup.testUrl || null,
    getLatencyByName: proxiesStore.getLatencyByName,
    isProxyGroup: proxiesStore.isProxyGroup,
    latencyQualityMap: configStore.latencyQualityMap,
    urlForLatencyTest: configStore.urlForLatencyTest,
  })

  return filterProxiesByName(available, configStore.proxiesGroupNameFilter)
}

function getProviderProxyNames(
  provider: ProxyProvider & { proxies: ProxyNodeWithProvider[] },
) {
  const sorted = sortProxiesByOrderingType({
    proxyNames: provider.proxies.map((p) => p.name),
    orderingType: configStore.proxiesOrderingType,
    testUrl: provider.testUrl,
    getLatencyByName: proxiesStore.getLatencyByName,
    isProxyGroup: proxiesStore.isProxyGroup,
    latencyQualityMap: configStore.latencyQualityMap,
    urlForLatencyTest: configStore.urlForLatencyTest,
    performanceData: nodeRecommendationStore.performanceData,
  })

  return filterProxiesByName(sorted, configStore.proxiesGroupNameFilter)
}

// Cache sorted/filtered proxy names per group so each render reuses the result
// instead of recomputing the sort + availability filter on every re-render
// (previously called twice per group per frame from the template).
const sortedNamesByGroup = computed(() => {
  const map: Record<string, string[]> = {}
  for (const proxyGroup of renderProxies.value) {
    map[proxyGroup.name] = getSortedProxyNames(proxyGroup)
  }
  return map
})

const sortedNamesByProvider = computed(() => {
  const map: Record<string, string[]> = {}
  for (const provider of proxiesStore.proxyProviders) {
    map[provider.name] = getProviderProxyNames(provider)
  }
  return map
})

// Fetch proxies on mount
onMounted(() => {
  proxiesStore.fetchProxies()
})

// Enable window focus refetch for proxies data
watch(
  useWindowFocus(),
  useThrottleFn(
    (focused) => {
      if (focused) proxiesStore.fetchProxies()
    },
    30000,
    true,
    true,
  ),
)

// ProxyGroupTitle component
const ProxyGroupTitle = defineComponent({
  props: {
    proxyGroup: { type: Object as () => ProxyType, required: true },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  setup(props) {
    const recommendedNode = computed(() => getRecommendedNode(props.proxyGroup))
    const totalProxyCount = computed(() => props.proxyGroup.all?.length ?? 0)
    const aliveProxyCount = computed(
      () =>
        props.proxyGroup.all?.filter(
          (proxyName) => proxiesStore.proxyNodeMap[proxyName]?.alive === true,
        ).length ?? 0,
    )
    const hasRecommendation = computed(
      () =>
        recommendedNode.value !== null &&
        recommendedNode.value !== props.proxyGroup.now,
    )

    return () =>
      h('div', { class: 'flex flex-col gap-3 flex-1 min-w-0' }, [
        h(
          'div',
          {
            class: 'flex items-center justify-between gap-2 w-full flex-nowrap',
          },
          [
            h(
              'div',
              { class: 'flex flex-wrap items-center gap-2 flex-1 min-w-0' },
              [
                // Icon support
                props.proxyGroup.icon &&
                  (props.proxyGroup.icon.startsWith('data:image/svg+xml')
                    ? h('div', {
                        style: {
                          height: `${configStore.iconHeight}px`,
                          width: `${configStore.iconHeight}px`,
                          color: 'var(--color-primary)',
                          backgroundColor: 'currentColor',
                          marginRight: `${configStore.iconMarginRight}px`,
                          maskImage: `url('${encodeSvg(props.proxyGroup.icon)}')`,
                          maskSize: '100% 100%',
                        },
                      })
                    : h('img', {
                        src: props.proxyGroup.icon,
                        style: {
                          height: `${configStore.iconHeight}px`,
                          marginRight: `${configStore.iconMarginRight}px`,
                        },
                      })),
                h(
                  'span',
                  {
                    class:
                      'text-lg font-semibold tracking-tight line-clamp-1 break-all text-base-content',
                  },
                  props.proxyGroup.name,
                ),
                h(
                  'div',
                  {
                    class:
                      'badge badge-sm text-[0.7rem] font-semibold px-2 py-1 rounded-md bg-primary/12 text-primary border border-primary/20',
                  },
                  `${aliveProxyCount.value} / ${totalProxyCount.value}`,
                ),
              ],
            ),
            h('div', { class: 'flex items-center gap-1.5 shrink-0' }, [
              // Switch to Recommended button
              hasRecommendation.value &&
                h(
                  Button,
                  {
                    class:
                      'flex items-center justify-center w-9 h-9 rounded-lg bg-warning/10 border border-warning/20 text-warning transition-all duration-200 hover:bg-warning/20 hover:border-warning/40 hover:-translate-y-px hover:shadow-lg hover:shadow-warning/15 active:translate-y-0',
                    title:
                      t(
                        'recommendation.switchToRecommended',
                        'Switch to Recommended: ',
                      ) + recommendedNode.value,
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      switchToRecommended(props.proxyGroup)
                    },
                  },
                  {
                    default: () => h(IconWand, { size: 18 }),
                  },
                ),
              // Unfix button — only shown when this automatic group has a manual
              // pin (mihomo reports it via `fixed`). Clicking restores auto-select.
              !!props.proxyGroup.fixed &&
                h(
                  Button,
                  {
                    class:
                      'flex items-center justify-center w-9 h-9 rounded-lg bg-warning/10 border border-warning/20 text-warning transition-all duration-200 hover:bg-warning/20 hover:border-warning/40 hover:-translate-y-px hover:shadow-lg hover:shadow-warning/15 active:translate-y-0',
                    title: t('unfixProxy'),
                    onClick: (e: MouseEvent) => {
                      e.stopPropagation()
                      proxiesStore.unfixProxyInGroup(props.proxyGroup.name)
                    },
                  },
                  {
                    default: () => h(IconPinnedOff, { size: 18 }),
                  },
                ),
              h(
                Button,
                {
                  class:
                    'flex items-center justify-center w-9 h-9 rounded-lg bg-base-content/6 border border-base-content/8 text-base-content/60 transition-all duration-200 hover:bg-primary/15 hover:border-primary/30 hover:text-primary hover:-translate-y-px hover:shadow-lg hover:shadow-primary/15 active:translate-y-0 disabled:bg-success/15 disabled:border-success/30 disabled:cursor-not-allowed disabled:opacity-100',
                  disabled:
                    proxiesStore.proxyGroupLatencyTestingMap[
                      props.proxyGroup.name
                    ],
                  onClick: async (e: MouseEvent) => {
                    e.stopPropagation()
                    await proxiesStore.proxyGroupLatencyTest(
                      props.proxyGroup.name,
                    )
                    autoSwitchAfterTest([props.proxyGroup])
                  },
                },
                {
                  default: () =>
                    h(IconBrandSpeedtest, {
                      size: 18,
                      class: {
                        'animate-pulse text-success':
                          proxiesStore.proxyGroupLatencyTestingMap[
                            props.proxyGroup.name
                          ],
                      },
                    }),
                },
              ),
            ]),
          ],
        ),
        h('div', { class: 'flex flex-col gap-2.5 pt-1' }, [
          h(
            'div',
            {
              class:
                'badge badge-primary badge-sm inline-flex items-center gap-1',
            },
            [
              h(
                'span',
                { class: 'font-bold' },
                formatProxyType(props.proxyGroup.type, t),
              ),
              props.proxyGroup.now?.length > 0 && [
                h(IconChevronRight, { size: 18 }),
                h('span', { class: 'whitespace-nowrap' }, props.proxyGroup.now),
              ],
            ],
          ),
          h(
            'div',
            { class: 'badge badge-secondary badge-sm' },
            `${formatBytes(connectionsStore.speedGroupByName[props.proxyGroup.name] || 0)}/s`,
          ),
        ]),
        !proxiesStore.collapsedMap[props.proxyGroup.name] &&
          h(ProxyNodePreview, {
            proxyNameList: props.sortedProxyNames,
            now: props.proxyGroup.now,
            testUrl: props.proxyGroup.testUrl || null,
            onSelect: (name: string) =>
              proxiesStore.selectProxyInGroup(props.proxyGroup, name),
          }),
      ])
  },
})

// Pick the per-group node component for the current display mode (card is the
// default). Master-detail is not a per-group renderer — it bypasses Collapse and
// gets its own page-level branch in the template (see isMasterMode below).
function nodeComponentFor(mode: string) {
  if (mode === PROXIES_DISPLAY_MODE.LIST) return ProxyNodeListItem
  if (mode === PROXIES_DISPLAY_MODE.CHIPS) return ProxyNodeChip
  if (mode === PROXIES_DISPLAY_MODE.TABLE) return ProxyNodeTableRow
  return ProxyNodeCard
}

// Master-detail is a page-level layout (Proxies tab only), not a per-group
// node renderer, so it gets its own branch in the template.
const isMasterMode = computed(
  () => configStore.proxiesDisplayMode === PROXIES_DISPLAY_MODE.MASTER,
)

// ProxyNodes component
const ProxyNodes = defineComponent({
  props: {
    proxyGroup: { type: Object as () => ProxyType, required: true },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  setup(props) {
    const recommendedNode = computed(() => getRecommendedNode(props.proxyGroup))
    const renderCount = ref(PROXIES_INITIAL_RENDER_COUNT)
    const loadMoreSentinel = ref<HTMLElement | null>(null)

    // Keep the currently selected node within the rendered window, otherwise
    // it could be hidden below the fold after expanding the group.
    watch(
      () => [props.sortedProxyNames, props.proxyGroup.now] as const,
      ([names, now]) => {
        const index = names.indexOf(now)
        if (index >= renderCount.value) {
          renderCount.value = index + PROXIES_RENDER_STEP
        }
      },
      { immediate: true },
    )

    useIntersectionObserver(
      loadMoreSentinel,
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          renderCount.value < props.sortedProxyNames.length
        ) {
          renderCount.value = Math.min(
            renderCount.value + PROXIES_RENDER_STEP,
            props.sortedProxyNames.length,
          )
        }
      },
      { root: proxiesScrollEl, rootMargin: '600px' },
    )

    return () => {
      const names = props.sortedProxyNames
      const Comp = nodeComponentFor(configStore.proxiesDisplayMode)
      // isRecommended/groupName are card-only props. ListItem/Chip/TableRow don't
      // declare them, and Vue turns undeclared props into fallthrough DOM
      // attributes — so only pass them to the card to keep other rows' markup clean.
      const isCard = Comp === ProxyNodeCard
      const children = names.slice(0, renderCount.value).map((proxyName) =>
        h(Comp, {
          key: proxyName,
          proxyName,
          testUrl: props.proxyGroup.testUrl || null,
          timeout: props.proxyGroup.timeout ?? null,
          isSelected: props.proxyGroup.now === proxyName,
          ...(isCard
            ? {
                isRecommended: recommendedNode.value === proxyName,
                groupName: props.proxyGroup.name,
              }
            : {}),
          onClick: () =>
            proxiesStore.selectProxyInGroup(props.proxyGroup, proxyName),
        }),
      )

      if (renderCount.value < names.length) {
        children.push(
          h('div', {
            ref: loadMoreSentinel,
            key: '__load_more__',
            'aria-hidden': 'true',
            class: 'h-px w-full',
            style: { gridColumn: '1 / -1' },
          }),
        )
      }

      return children
    }
  },
})

// ProxyProviderTitle component
const ProxyProviderTitle = defineComponent({
  props: {
    provider: {
      type: Object as () => ProxyProvider & {
        proxies: ProxyNodeWithProvider[]
      },
      required: true,
    },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  setup(props) {
    return () =>
      h('div', { class: 'flex flex-col gap-3 flex-1 min-w-0' }, [
        h(
          'div',
          {
            class: 'flex items-center justify-between gap-2 w-full flex-nowrap',
          },
          [
            h(
              'div',
              { class: 'flex flex-wrap items-center gap-2 flex-1 min-w-0' },
              [
                h(
                  'span',
                  {
                    class:
                      'text-lg font-semibold tracking-tight line-clamp-1 break-all text-base-content',
                  },
                  props.provider.name,
                ),
                h(
                  'div',
                  {
                    class:
                      'badge badge-sm text-[0.7rem] font-semibold px-2 py-1 rounded-md bg-primary/12 text-primary border border-primary/20',
                  },
                  props.provider.proxies.length,
                ),
                h(
                  'div',
                  {
                    class:
                      'badge badge-sm text-[0.7rem] font-semibold px-2 py-1 rounded-md bg-primary/12 text-primary border border-primary/20',
                  },
                  props.provider.vehicleType,
                ),
              ],
            ),
            h('div', { class: 'flex items-center gap-1.5 shrink-0' }, [
              h(
                Button,
                {
                  class:
                    'flex items-center justify-center w-9 h-9 rounded-lg bg-base-content/6 border border-base-content/8 text-base-content/60 transition-all duration-200 hover:bg-primary/15 hover:border-primary/30 hover:text-primary hover:-translate-y-px hover:shadow-lg hover:shadow-primary/15 active:translate-y-0 disabled:bg-success/15 disabled:border-success/30 disabled:cursor-not-allowed disabled:opacity-100',
                  disabled: proxiesStore.updatingMap[props.provider.name],
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    proxiesStore.updateProviderByProviderName(
                      props.provider.name,
                    )
                  },
                },
                {
                  default: () =>
                    h(IconReload, {
                      size: 18,
                      class: {
                        'animate-spin text-success':
                          proxiesStore.updatingMap[props.provider.name],
                      },
                    }),
                },
              ),
              h(
                Button,
                {
                  class:
                    'flex items-center justify-center w-9 h-9 rounded-lg bg-base-content/6 border border-base-content/8 text-base-content/60 transition-all duration-200 hover:bg-primary/15 hover:border-primary/30 hover:text-primary hover:-translate-y-px hover:shadow-lg hover:shadow-primary/15 active:translate-y-0 disabled:bg-success/15 disabled:border-success/30 disabled:cursor-not-allowed disabled:opacity-100',
                  disabled:
                    proxiesStore.proxyProviderLatencyTestingMap[
                      props.provider.name
                    ],
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    proxiesStore.proxyProviderLatencyTest(props.provider.name)
                  },
                },
                {
                  default: () =>
                    h(IconBrandSpeedtest, {
                      size: 18,
                      class: {
                        'animate-pulse text-success':
                          proxiesStore.proxyProviderLatencyTestingMap[
                            props.provider.name
                          ],
                      },
                    }),
                },
              ),
            ]),
          ],
        ),
        h(SubscriptionInfo, {
          subscriptionInfo: props.provider.subscriptionInfo,
        }),
        h('div', { class: 'flex flex-col gap-2.5 pt-1' }, [
          h(
            'div',
            {
              class:
                'inline-flex items-center gap-1.5 text-xs font-medium text-base-content/45 px-2.5 py-1 bg-base-content/5 rounded-full w-fit',
            },
            `${t('updated')} ${formatTimeFromNow(props.provider.updatedAt, locale.value)}`,
          ),
          !proxiesStore.collapsedMap[props.provider.name] &&
            h(ProxyNodePreview, {
              proxyNameList: props.sortedProxyNames,
              testUrl: props.provider.testUrl,
            }),
        ]),
      ])
  },
})

// ProviderProxyNodes component
const ProviderProxyNodes = defineComponent({
  props: {
    provider: {
      type: Object as () => ProxyProvider & {
        proxies: ProxyNodeWithProvider[]
      },
      required: true,
    },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  setup(props) {
    const renderCount = ref(PROXIES_INITIAL_RENDER_COUNT)
    const loadMoreSentinel = ref<HTMLElement | null>(null)

    useIntersectionObserver(
      loadMoreSentinel,
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          renderCount.value < props.sortedProxyNames.length
        ) {
          renderCount.value = Math.min(
            renderCount.value + PROXIES_RENDER_STEP,
            props.sortedProxyNames.length,
          )
        }
      },
      { root: providersScrollEl, rootMargin: '600px' },
    )

    return () => {
      const names = props.sortedProxyNames
      // Provider tab does not support master-detail; degrade master → list.
      const providerMode =
        configStore.proxiesDisplayMode === PROXIES_DISPLAY_MODE.MASTER
          ? PROXIES_DISPLAY_MODE.LIST
          : configStore.proxiesDisplayMode
      const Comp = nodeComponentFor(providerMode)
      const children = names.slice(0, renderCount.value).map((proxyName) =>
        h(Comp, {
          key: proxyName,
          proxyName,
          testUrl: props.provider.testUrl,
          timeout: props.provider.timeout ?? null,
          providerName: props.provider.name,
        }),
      )

      if (renderCount.value < names.length) {
        children.push(
          h('div', {
            ref: loadMoreSentinel,
            key: '__load_more__',
            'aria-hidden': 'true',
            class: 'h-px w-full',
            style: { gridColumn: '1 / -1' },
          }),
        )
      }

      return children
    }
  },
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <!-- First-run nudge: shown only when the agent is present and no base
         profile exists yet (self-gating; nothing in web mode). -->
    <OnboardingEmptyState context="proxies" />

    <!-- Header with Tabs and Actions -->
    <div
      class="animate-fade-slide-in flex shrink-0 flex-wrap items-center gap-3"
    >
      <!-- Tabs -->
      <div
        class="flex gap-1 rounded-xl border border-base-content/8 bg-base-200/60 p-1 backdrop-blur-sm"
      >
        <button
          v-for="tab in tabs"
          :key="tab.type"
          class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-base-content/70 transition-all duration-200 hover:bg-base-content/5"
          :class="{
            'bg-primary text-primary-content shadow-md shadow-primary/30 hover:bg-primary':
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

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <ProxiesDisplayModeSwitcher />

        <!-- Collapse / Expand All Groups Button -->
        <Button
          v-if="activeTab === 'proxies'"
          class="flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-base-content/10 bg-base-200/80 px-3 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary"
          :title="
            anyGroupExpanded
              ? t('collapseAll', 'Collapse All')
              : t('expandAll', 'Expand All')
          "
          @click="toggleAllGroups"
        >
          <IconChevronsUp v-if="anyGroupExpanded" :size="18" />
          <IconChevronsDown v-else :size="18" />
          <span class="hidden text-sm font-medium sm:inline">
            {{
              anyGroupExpanded
                ? t('collapseAll', 'Collapse All')
                : t('expandAll', 'Expand All')
            }}
          </span>
        </Button>

        <!-- Test All Groups Button -->
        <Button
          v-if="activeTab === 'proxies'"
          class="flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-base-content/10 bg-base-200/80 px-3 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary"
          :disabled="isBatchTesting"
          :title="t('recommendation.testAllGroups', 'Test All Groups')"
          @click="testAllGroups"
        >
          <IconBrandSpeedtest
            :size="18"
            :class="{ 'animate-pulse text-success': isBatchTesting }"
          />
          <span class="hidden text-sm font-medium sm:inline">
            {{ t('recommendation.testAll', 'Test All') }}
          </span>
        </Button>

        <!-- Batch Test Progress Indicator -->
        <div
          v-if="isBatchTesting"
          class="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-1.5 text-sm text-success"
        >
          <span class="loading loading-xs loading-spinner" />
          <span>
            {{ nodeRecommendationStore.batchTestProgress.completed }}/{{
              nodeRecommendationStore.batchTestProgress.total
            }}
          </span>
          <span
            v-if="nodeRecommendationStore.batchTestProgress.current"
            class="max-w-24 truncate text-xs opacity-70"
          >
            {{ nodeRecommendationStore.batchTestProgress.current }}
          </span>
        </div>

        <!-- Health-check All Providers Button -->
        <Button
          v-if="activeTab === 'proxyProviders'"
          class="flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-base-content/10 bg-base-200/80 px-3 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary"
          :disabled="isBatchTesting"
          :title="t('healthCheckAllProviders')"
          @click="healthCheckAllProviders"
        >
          <IconBrandSpeedtest
            :size="18"
            :class="{ 'animate-pulse text-success': isBatchTesting }"
          />
          <span class="hidden text-sm font-medium sm:inline">
            {{ t('healthCheckAllProviders') }}
          </span>
        </Button>

        <Button
          v-if="activeTab === 'proxyProviders'"
          class="flex h-9 w-9 items-center justify-center rounded-[0.625rem] border border-base-content/10 bg-base-200/80 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary"
          :disabled="proxiesStore.isAllProviderUpdating"
          @click="proxiesStore.updateAllProvider"
        >
          <IconReload
            :size="18"
            :class="{
              'animate-spin text-success': proxiesStore.isAllProviderUpdating,
            }"
          />
        </Button>
      </div>

      <!-- Node Name Filter -->
      <div
        class="ml-auto flex h-9 min-w-40 flex-1 items-center gap-2 rounded-[0.625rem] border border-base-content/10 bg-base-200/80 px-3 transition-all duration-200 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px] focus-within:shadow-primary/10 sm:max-w-64"
      >
        <IconSearch :size="16" class="shrink-0 opacity-50" />
        <input
          v-model="configStore.proxiesGroupNameFilter"
          class="w-full bg-transparent text-sm outline-none placeholder:opacity-50"
          type="search"
          :placeholder="t('filterNodesByName')"
        />
        <Button
          v-if="configStore.proxiesGroupNameFilter"
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-base-content/45 transition-colors duration-200 hover:bg-base-content/10 hover:text-base-content"
          :title="t('clear')"
          @click="configStore.proxiesGroupNameFilter = ''"
        >
          <IconX :size="14" />
        </Button>
      </div>

      <!-- Connectivity Board Button -->
      <div>
        <Button
          class="flex h-9 w-9 items-center justify-center rounded-[0.625rem] border border-base-content/10 bg-base-200/80 text-base-content/70 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary"
          :title="t('connectivityBoard')"
          @click="connectivityModal?.open()"
        >
          <IconActivity :size="18" />
        </Button>
      </div>

      <!-- Settings Button -->
      <div>
        <Button
          class="flex h-9 w-9 items-center justify-center rounded-[0.625rem] border border-base-content/10 bg-primary/10 text-primary transition-all duration-200 hover:border-primary/30 hover:bg-primary/15"
          @click="settingsModal?.open()"
        >
          <IconSettings :size="18" />
        </Button>
      </div>
    </div>

    <!-- Proxy Groups Content -->
    <div
      v-if="activeTab === 'proxies'"
      ref="proxiesScrollEl"
      class="min-h-0 flex-1 overflow-y-auto"
      :class="isMasterMode ? 'overflow-hidden' : ''"
    >
      <!-- Loading skeleton: first load / refetch before anything resolves -->
      <div
        v-if="!proxiesStore.proxiesLoaded && renderProxies.length === 0"
        class="flex flex-col gap-3 p-1"
      >
        <div
          v-for="i in 4"
          :key="i"
          class="h-20 animate-pulse rounded-xl bg-base-content/5"
        />
      </div>
      <!-- Empty state: loaded but no proxy groups to show -->
      <div
        v-else-if="renderProxies.length === 0"
        class="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-base-content/40"
      >
        <span class="text-sm">{{ t('noData') }}</span>
      </div>
      <template v-else>
        <ProxyMasterDetail
          v-if="isMasterMode"
          :groups="renderProxies"
          :sorted-names-by-group="sortedNamesByGroup"
        />
        <ProxiesRenderWrapper v-else ref="proxyGroupsWrapper">
          <template v-if="proxyGroupsWrapper?.isTwoColumns" #even>
            <Collapse
              v-for="(proxyGroup, index) in renderProxies.filter(
                (_, i) => i % 2 === 0,
              )"
              :key="proxyGroup.name"
              class="animate-fade-slide-in"
              :style="{ animationDelay: `${index * 50}ms` }"
              :is-open="proxiesStore.collapsedMap[proxyGroup.name] || false"
              @collapse="
                (val) => (proxiesStore.collapsedMap[proxyGroup.name] = val)
              "
            >
              <template #title>
                <ProxyGroupTitle
                  :proxy-group="proxyGroup"
                  :sorted-proxy-names="
                    sortedNamesByGroup[proxyGroup.name] || []
                  "
                />
              </template>
              <ProxyNodes
                :proxy-group="proxyGroup"
                :sorted-proxy-names="sortedNamesByGroup[proxyGroup.name] || []"
              />
            </Collapse>
          </template>

          <template v-if="proxyGroupsWrapper?.isTwoColumns" #odd>
            <Collapse
              v-for="(proxyGroup, index) in renderProxies.filter(
                (_, i) => i % 2 === 1,
              )"
              :key="proxyGroup.name"
              class="animate-fade-slide-in"
              :style="{ animationDelay: `${index * 50 + 25}ms` }"
              :is-open="proxiesStore.collapsedMap[proxyGroup.name] || false"
              @collapse="
                (val) => (proxiesStore.collapsedMap[proxyGroup.name] = val)
              "
            >
              <template #title>
                <ProxyGroupTitle
                  :proxy-group="proxyGroup"
                  :sorted-proxy-names="
                    sortedNamesByGroup[proxyGroup.name] || []
                  "
                />
              </template>
              <ProxyNodes
                :proxy-group="proxyGroup"
                :sorted-proxy-names="sortedNamesByGroup[proxyGroup.name] || []"
              />
            </Collapse>
          </template>

          <template v-if="!proxyGroupsWrapper?.isTwoColumns" #default>
            <Collapse
              v-for="(proxyGroup, index) in renderProxies"
              :key="proxyGroup.name"
              class="animate-fade-slide-in"
              :style="{ animationDelay: `${index * 40}ms` }"
              :is-open="proxiesStore.collapsedMap[proxyGroup.name] || false"
              @collapse="
                (val) => (proxiesStore.collapsedMap[proxyGroup.name] = val)
              "
            >
              <template #title>
                <ProxyGroupTitle
                  :proxy-group="proxyGroup"
                  :sorted-proxy-names="
                    sortedNamesByGroup[proxyGroup.name] || []
                  "
                />
              </template>
              <ProxyNodes
                :proxy-group="proxyGroup"
                :sorted-proxy-names="sortedNamesByGroup[proxyGroup.name] || []"
              />
            </Collapse>
          </template>
        </ProxiesRenderWrapper>
      </template>
    </div>

    <!-- Proxy Providers Content -->
    <div v-else ref="providersScrollEl" class="min-h-0 flex-1 overflow-y-auto">
      <!-- Loading skeleton: first load before providers resolve -->
      <div
        v-if="
          !proxiesStore.proxiesLoaded &&
          proxiesStore.proxyProviders.length === 0
        "
        class="flex flex-col gap-3 p-1"
      >
        <div
          v-for="i in 3"
          :key="i"
          class="h-20 animate-pulse rounded-xl bg-base-content/5"
        />
      </div>
      <!-- Empty state: loaded but no providers -->
      <div
        v-else-if="proxiesStore.proxyProviders.length === 0"
        class="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-base-content/40"
      >
        <span class="text-sm">{{ t('noData') }}</span>
      </div>
      <ProxiesRenderWrapper v-else ref="providersWrapper">
        <template v-if="providersWrapper?.isTwoColumns" #even>
          <Collapse
            v-for="(provider, index) in proxiesStore.proxyProviders.filter(
              (_, i) => i % 2 === 0,
            )"
            :key="provider.name"
            class="animate-fade-slide-in"
            :style="{ animationDelay: `${index * 50}ms` }"
            :is-open="proxiesStore.collapsedMap[provider.name] || false"
            @collapse="
              (val) => (proxiesStore.collapsedMap[provider.name] = val)
            "
          >
            <template #title>
              <ProxyProviderTitle
                :provider="provider"
                :sorted-proxy-names="sortedNamesByProvider[provider.name] || []"
              />
            </template>
            <ProviderProxyNodes
              :provider="provider"
              :sorted-proxy-names="sortedNamesByProvider[provider.name] || []"
            />
          </Collapse>
        </template>

        <template v-if="providersWrapper?.isTwoColumns" #odd>
          <Collapse
            v-for="(provider, index) in proxiesStore.proxyProviders.filter(
              (_, i) => i % 2 === 1,
            )"
            :key="provider.name"
            class="animate-fade-slide-in"
            :style="{ animationDelay: `${index * 50 + 25}ms` }"
            :is-open="proxiesStore.collapsedMap[provider.name] || false"
            @collapse="
              (val) => (proxiesStore.collapsedMap[provider.name] = val)
            "
          >
            <template #title>
              <ProxyProviderTitle
                :provider="provider"
                :sorted-proxy-names="sortedNamesByProvider[provider.name] || []"
              />
            </template>
            <ProviderProxyNodes
              :provider="provider"
              :sorted-proxy-names="sortedNamesByProvider[provider.name] || []"
            />
          </Collapse>
        </template>

        <template v-if="!providersWrapper?.isTwoColumns" #default>
          <Collapse
            v-for="(provider, index) in proxiesStore.proxyProviders"
            :key="provider.name"
            class="animate-fade-slide-in"
            :style="{ animationDelay: `${index * 40}ms` }"
            :is-open="proxiesStore.collapsedMap[provider.name] || false"
            @collapse="
              (val) => (proxiesStore.collapsedMap[provider.name] = val)
            "
          >
            <template #title>
              <ProxyProviderTitle
                :provider="provider"
                :sorted-proxy-names="sortedNamesByProvider[provider.name] || []"
              />
            </template>
            <ProviderProxyNodes
              :provider="provider"
              :sorted-proxy-names="sortedNamesByProvider[provider.name] || []"
            />
          </Collapse>
        </template>
      </ProxiesRenderWrapper>
    </div>

    <!-- Settings Modal -->
    <Modal ref="settingsModal" :title="t('proxiesSettings')">
      <template #icon>
        <IconGlobe :size="24" />
      </template>

      <div class="flex flex-col gap-4">
        <div>
          <ConfigTitle with-divider>
            {{ t('autoCloseConns') }}
          </ConfigTitle>
          <div class="flex w-full justify-center">
            <input
              v-model="configStore.autoCloseConns"
              class="toggle toggle-primary"
              type="checkbox"
            />
          </div>
        </div>

        <div class="flex flex-col">
          <ConfigTitle with-divider>
            {{ t('urlForLatencyTest') }}
          </ConfigTitle>
          <input
            v-model="configStore.urlForLatencyTest"
            class="input-bordered input w-full"
            type="text"
          />
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('latencyTestTimeoutDuration') }} ({{ t('ms') }})
          </ConfigTitle>
          <input
            v-model.number="configStore.latencyTestTimeoutDuration"
            class="input-bordered input w-full"
            type="number"
          />
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('latencyMediumThreshold') }} ({{ t('ms') }})
          </ConfigTitle>
          <input
            v-model.number="configStore.latencyMediumThreshold"
            :placeholder="t('thresholdAutoPlaceholder')"
            class="input-bordered input w-full"
            type="number"
            min="0"
          />
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('latencyHighThreshold') }} ({{ t('ms') }})
          </ConfigTitle>
          <input
            v-model.number="configStore.latencyHighThreshold"
            :placeholder="t('thresholdAutoPlaceholder')"
            class="input-bordered input w-full"
            type="number"
            min="0"
          />
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('proxiesSorting') }}
          </ConfigTitle>
          <select
            v-model="configStore.proxiesOrderingType"
            class="select-bordered select w-full"
          >
            <option value="orderNatural">
              {{ t('orderNatural') }}
            </option>
            <option value="orderLatency_asc">
              {{ t('orderLatency_asc') }}
            </option>
            <option value="orderLatency_desc">
              {{ t('orderLatency_desc') }}
            </option>
            <option value="orderQuality_asc">
              {{ t('orderQuality_asc') }}
            </option>
            <option value="orderQuality_desc">
              {{ t('orderQuality_desc') }}
            </option>
            <option value="orderName_asc">
              {{ t('orderName_asc') }}
            </option>
            <option value="orderName_desc">
              {{ t('orderName_desc') }}
            </option>
          </select>
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('hideUnavailableProxies') }}
          </ConfigTitle>
          <div class="flex w-full justify-center">
            <input
              v-model="configStore.hideUnAvailableProxies"
              class="toggle toggle-primary"
              type="checkbox"
            />
          </div>
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('renderInTwoColumns') }}
          </ConfigTitle>
          <div class="flex w-full justify-center">
            <input
              v-model="configStore.renderProxiesInTwoColumns"
              class="toggle toggle-primary"
              type="checkbox"
            />
          </div>
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('proxiesCardSize') }}
          </ConfigTitle>
          <select
            v-model="configStore.proxiesCardSize"
            class="select-bordered select w-full"
          >
            <option value="comfortable">
              {{ t('cardSizeComfortable') }}
            </option>
            <option value="compact">
              {{ t('cardSizeCompact') }}
            </option>
            <option value="tight">
              {{ t('cardSizeTight') }}
            </option>
          </select>
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('stickyGroupHeader') }}
          </ConfigTitle>
          <div class="flex w-full justify-center">
            <input
              v-model="configStore.stickyGroupHeader"
              class="toggle toggle-primary"
              type="checkbox"
            />
          </div>
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('proxiesPreviewType') }}
          </ConfigTitle>
          <select
            v-model="configStore.proxiesPreviewType"
            class="select-bordered select w-full"
          >
            <option value="auto">
              {{ t('auto') }}
            </option>
            <option value="dots">
              {{ t('dots') }}
            </option>
            <option value="bar">
              {{ t('bar') }}
            </option>
            <option value="off">
              {{ t('off') }}
            </option>
          </select>

          <template
            v-if="configStore.proxiesPreviewType === PROXIES_PREVIEW_TYPE.Auto"
          >
            <ConfigTitle with-divider>
              {{ t('proxiesPreviewAutoThreshold') }}
            </ConfigTitle>
            <input
              v-model.number="configStore.proxiesPreviewAutoThreshold"
              class="input-bordered input w-full"
              type="number"
              min="1"
            />
          </template>
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('iconHeight') }}
          </ConfigTitle>
          <input
            v-model.number="configStore.iconHeight"
            class="input-bordered input w-full"
            type="number"
          />

          <ConfigTitle with-divider>
            {{ t('iconMarginRight') }}
          </ConfigTitle>
          <input
            v-model.number="configStore.iconMarginRight"
            class="input-bordered input w-full"
            type="number"
          />
        </div>

        <div>
          <button
            class="btn w-full btn-error"
            @click="configStore.resetProxiesSettings()"
          >
            {{ t('resetSettings') }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Connectivity Board Modal -->
    <Modal ref="connectivityModal" :title="t('connectivityBoard')">
      <template #icon>
        <IconActivity :size="24" />
      </template>

      <ConnectivityBoard />
    </Modal>
  </div>
</template>

<style scoped>
/* Custom animation keyframe - cannot be done with Tailwind */
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

.animate-fade-slide-in {
  animation: fade-slide-in 0.4s ease-out backwards;
}
</style>
