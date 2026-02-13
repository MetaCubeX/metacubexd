<script setup lang="ts">
import type {
  ProxyNodeWithProvider,
  ProxyProvider,
  Proxy as ProxyType,
} from '~/types'
import {
  IconBrandSpeedtest,
  IconChevronRight,
  IconGlobe,
  IconReload,
  IconSettings,
  IconWand,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import Button from '~/components/Button.vue'
import ProxyNodeCard from '~/components/ProxyNodeCard.vue'
import ProxyNodeListItem from '~/components/ProxyNodeListItem.vue'
import ProxyNodePreview from '~/components/ProxyNodePreview.vue'
import SubscriptionInfo from '~/components/SubscriptionInfo.vue'
import { useBatchLatencyTest } from '~/composables/useBatchLatencyTest'
import {
  encodeSvg,
  filterProxiesByAvailability,
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
const { isRunning: isBatchTesting, testMultipleGroups } = useBatchLatencyTest()

const activeTab = ref<'proxies' | 'proxyProviders'>('proxies')
const settingsModal = ref<{ open: () => void; close: () => void }>()
const proxyGroupsWrapper = ref<{ isTwoColumns: boolean }>()
const providersWrapper = ref<{ isTwoColumns: boolean }>()

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
}

// Switch to recommended node in a group
const switchToRecommended = (proxyGroup: ProxyType) => {
  const recommended = getRecommendedNode(proxyGroup)
  if (recommended) {
    proxiesStore.selectProxyInGroup(proxyGroup, recommended)
  }
}

const renderProxies = computed(() =>
  proxiesStore.proxies.filter((proxy) => !proxy.hidden),
)

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
  const sorted = sortProxiesByOrderingType({
    proxyNames: proxyGroup.all ?? [],
    orderingType: configStore.proxiesOrderingType,
    testUrl: proxyGroup.testUrl || null,
    getLatencyByName: proxiesStore.getLatencyByName,
    latencyQualityMap: configStore.latencyQualityMap,
    urlForLatencyTest: configStore.urlForLatencyTest,
  })

  return filterProxiesByAvailability({
    proxyNames: sorted,
    enabled: configStore.hideUnAvailableProxies,
    testUrl: proxyGroup.testUrl || null,
    getLatencyByName: proxiesStore.getLatencyByName,
    isProxyGroup: proxiesStore.isProxyGroup,
    latencyQualityMap: configStore.latencyQualityMap,
    urlForLatencyTest: configStore.urlForLatencyTest,
  })
}

function getProviderProxyNames(
  provider: ProxyProvider & { proxies: ProxyNodeWithProvider[] },
) {
  return sortProxiesByOrderingType({
    proxyNames: provider.proxies.map((p) => p.name),
    orderingType: configStore.proxiesOrderingType,
    testUrl: provider.testUrl,
    getLatencyByName: proxiesStore.getLatencyByName,
    latencyQualityMap: configStore.latencyQualityMap,
    urlForLatencyTest: configStore.urlForLatencyTest,
  })
}

// Fetch proxies on mount
onMounted(() => {
  proxiesStore.fetchProxies()
})

// ProxyGroupTitle component
const ProxyGroupTitle = defineComponent({
  props: {
    proxyGroup: { type: Object as () => ProxyType, required: true },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  setup(props) {
    const recommendedNode = computed(() => getRecommendedNode(props.proxyGroup))
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
                  props.proxyGroup.all?.length,
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
              h(
                Button,
                {
                  class:
                    'flex items-center justify-center w-9 h-9 rounded-lg bg-base-content/6 border border-base-content/8 text-base-content/60 transition-all duration-200 hover:bg-primary/15 hover:border-primary/30 hover:text-primary hover:-translate-y-px hover:shadow-lg hover:shadow-primary/15 active:translate-y-0 disabled:bg-success/15 disabled:border-success/30 disabled:cursor-not-allowed disabled:opacity-100',
                  disabled:
                    proxiesStore.proxyGroupLatencyTestingMap[
                      props.proxyGroup.name
                    ],
                  onClick: (e: MouseEvent) => {
                    e.stopPropagation()
                    proxiesStore.proxyGroupLatencyTest(props.proxyGroup.name)
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

// ProxyNodes component
const ProxyNodes = defineComponent({
  props: {
    proxyGroup: { type: Object as () => ProxyType, required: true },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  setup(props) {
    const recommendedNode = computed(() => getRecommendedNode(props.proxyGroup))

    return () =>
      props.sortedProxyNames.map((proxyName) =>
        configStore.proxiesDisplayMode === 'listMode'
          ? h(ProxyNodeListItem, {
              key: proxyName,
              proxyName,
              testUrl: props.proxyGroup.testUrl || null,
              timeout: props.proxyGroup.timeout ?? null,
              isSelected: props.proxyGroup.now === proxyName,
              onClick: () =>
                proxiesStore.selectProxyInGroup(props.proxyGroup, proxyName),
            })
          : h(ProxyNodeCard, {
              key: proxyName,
              proxyName,
              testUrl: props.proxyGroup.testUrl || null,
              timeout: props.proxyGroup.timeout ?? null,
              isSelected: props.proxyGroup.now === proxyName,
              isRecommended: recommendedNode.value === proxyName,
              groupName: props.proxyGroup.name,
              onClick: () =>
                proxiesStore.selectProxyInGroup(props.proxyGroup, proxyName),
            }),
      )
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
    return () =>
      props.sortedProxyNames.map((proxyName) =>
        configStore.proxiesDisplayMode === 'listMode'
          ? h(ProxyNodeListItem, {
              key: proxyName,
              proxyName,
              testUrl: props.provider.testUrl,
              timeout: props.provider.timeout ?? null,
              providerName: props.provider.name,
            })
          : h(ProxyNodeCard, {
              key: proxyName,
              proxyName,
              testUrl: props.provider.testUrl,
              timeout: props.provider.timeout ?? null,
              providerName: props.provider.name,
            }),
      )
  },
})
</script>

<template>
  <div class="flex h-full flex-col gap-3 overflow-y-auto p-2">
    <!-- Header with Tabs and Actions -->
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

      <!-- Settings Button -->
      <div class="ml-auto">
        <Button
          class="flex h-9 w-9 items-center justify-center rounded-[0.625rem] border border-base-content/10 bg-primary/10 text-primary transition-all duration-200 hover:border-primary/30 hover:bg-primary/15"
          @click="settingsModal?.open()"
        >
          <IconSettings :size="18" />
        </Button>
      </div>
    </div>

    <!-- Proxy Groups Content -->
    <div v-if="activeTab === 'proxies'" class="flex-1 overflow-y-auto">
      <ProxiesRenderWrapper ref="proxyGroupsWrapper">
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
                :sorted-proxy-names="getSortedProxyNames(proxyGroup)"
              />
            </template>
            <ProxyNodes
              :proxy-group="proxyGroup"
              :sorted-proxy-names="getSortedProxyNames(proxyGroup)"
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
                :sorted-proxy-names="getSortedProxyNames(proxyGroup)"
              />
            </template>
            <ProxyNodes
              :proxy-group="proxyGroup"
              :sorted-proxy-names="getSortedProxyNames(proxyGroup)"
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
                :sorted-proxy-names="getSortedProxyNames(proxyGroup)"
              />
            </template>
            <ProxyNodes
              :proxy-group="proxyGroup"
              :sorted-proxy-names="getSortedProxyNames(proxyGroup)"
            />
          </Collapse>
        </template>
      </ProxiesRenderWrapper>
    </div>

    <!-- Proxy Providers Content -->
    <div v-else class="flex-1 overflow-y-auto">
      <ProxiesRenderWrapper ref="providersWrapper">
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
                :sorted-proxy-names="getProviderProxyNames(provider)"
              />
            </template>
            <ProviderProxyNodes
              :provider="provider"
              :sorted-proxy-names="getProviderProxyNames(provider)"
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
                :sorted-proxy-names="getProviderProxyNames(provider)"
              />
            </template>
            <ProviderProxyNodes
              :provider="provider"
              :sorted-proxy-names="getProviderProxyNames(provider)"
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
                :sorted-proxy-names="getProviderProxyNames(provider)"
              />
            </template>
            <ProviderProxyNodes
              :provider="provider"
              :sorted-proxy-names="getProviderProxyNames(provider)"
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
            {{ t('proxiesDisplayMode') }}
          </ConfigTitle>
          <select
            v-model="configStore.proxiesDisplayMode"
            class="select-bordered select w-full"
          >
            <option value="cardMode">
              {{ t('cardMode') }}
            </option>
            <option value="listMode">
              {{ t('listMode') }}
            </option>
          </select>
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
