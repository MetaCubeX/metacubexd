<script setup lang="ts">
import type { Proxy, ProxyNodeWithProvider, ProxyProvider } from '~/types'
import {
  IconBrandSpeedtest,
  IconChevronRight,
  IconGlobe,
  IconReload,
  IconSettings,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import Button from '~/components/Button.vue'
import ProxyNodeCard from '~/components/ProxyNodeCard.vue'
import ProxyNodeListItem from '~/components/ProxyNodeListItem.vue'
import ProxyNodePreview from '~/components/ProxyNodePreview.vue'
import SubscriptionInfo from '~/components/SubscriptionInfo.vue'
import {
  encodeSvg,
  filterProxiesByAvailability,
  formatProxyType,
  formatTimeFromNow,
  sortProxiesByOrderingType,
} from '~/utils'

const { t, locale } = useI18n()

useHead({ title: computed(() => t('proxies')) })
const proxiesStore = useProxiesStore()
const connectionsStore = useConnectionsStore()
const configStore = useConfigStore()

const activeTab = ref<'proxies' | 'proxyProviders'>('proxies')
const settingsModal = ref<{ open: () => void; close: () => void }>()
const proxyGroupsWrapper = ref<{ isTwoColumns: boolean }>()
const providersWrapper = ref<{ isTwoColumns: boolean }>()

const formatBytes = (bytes: number) => byteSize(bytes).toString()

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

function getSortedProxyNames(proxyGroup: Proxy) {
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
    proxyGroup: { type: Object as () => Proxy, required: true },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  setup(props) {
    return () =>
      h('div', { class: 'space-y-2' }, [
        h('div', { class: 'flex items-center justify-between pr-8' }, [
          h('div', { class: 'flex items-center' }, [
            // Icon support
            props.proxyGroup.icon &&
              (props.proxyGroup.icon.startsWith('data:image/svg+xml')
                ? h('div', {
                    style: {
                      height: `${configStore.iconHeight}px`,
                      width: `${configStore.iconHeight}px`,
                      color: 'oklch(var(--p) / var(--tw-bg-opacity))',
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
            h('span', props.proxyGroup.name),
            h(
              'div',
              { class: 'badge badge-sm ml-2' },
              props.proxyGroup.all?.length,
            ),
          ]),
          h(
            Button,
            {
              class: 'btn-circle btn-sm',
              disabled:
                proxiesStore.proxyGroupLatencyTestingMap[props.proxyGroup.name],
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                proxiesStore.proxyGroupLatencyTest(props.proxyGroup.name)
              },
            },
            () =>
              h(IconBrandSpeedtest, {
                class: {
                  'animate-pulse text-success':
                    proxiesStore.proxyGroupLatencyTestingMap[
                      props.proxyGroup.name
                    ],
                },
              }),
          ),
        ]),
        h(
          'div',
          { class: 'flex flex-wrap items-center justify-between gap-2' },
          [
            h('div', { class: 'badge badge-primary badge-sm' }, [
              h(
                'span',
                { class: 'font-bold' },
                formatProxyType(props.proxyGroup.type, t),
              ),
              props.proxyGroup.now?.length > 0 && [
                h(IconChevronRight, { size: 18 }),
                h('span', { class: 'whitespace-nowrap' }, props.proxyGroup.now),
              ],
            ]),
            h(
              'div',
              { class: 'badge badge-secondary badge-sm' },
              `${formatBytes(connectionsStore.speedGroupByName[props.proxyGroup.name] || 0)}/s`,
            ),
          ],
        ),
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
    proxyGroup: { type: Object as () => Proxy, required: true },
    sortedProxyNames: { type: Array as () => string[], required: true },
  },
  setup(props) {
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
      h('div', [
        h('div', { class: 'flex items-center justify-between pr-8' }, [
          h('div', { class: 'flex flex-wrap items-center gap-1' }, [
            h('span', { class: 'line-clamp-1 break-all' }, props.provider.name),
            h(
              'div',
              { class: 'badge badge-sm' },
              props.provider.proxies.length,
            ),
            h('div', { class: 'badge badge-sm' }, props.provider.vehicleType),
          ]),
          h('div', { class: 'flex items-center gap-2' }, [
            h(
              Button,
              {
                class: 'btn btn-circle btn-sm',
                disabled: proxiesStore.updatingMap[props.provider.name],
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  proxiesStore.updateProviderByProviderName(props.provider.name)
                },
              },
              () =>
                h(IconReload, {
                  class: {
                    'animate-spin text-success':
                      proxiesStore.updatingMap[props.provider.name],
                  },
                }),
            ),
            h(
              Button,
              {
                class: 'btn btn-circle btn-sm',
                disabled:
                  proxiesStore.proxyProviderLatencyTestingMap[
                    props.provider.name
                  ],
                onClick: (e: MouseEvent) => {
                  e.stopPropagation()
                  proxiesStore.proxyProviderLatencyTest(props.provider.name)
                },
              },
              () =>
                h(IconBrandSpeedtest, {
                  class: {
                    'animate-pulse text-success':
                      proxiesStore.proxyProviderLatencyTestingMap[
                        props.provider.name
                      ],
                  },
                }),
            ),
          ]),
        ]),
        h(SubscriptionInfo, {
          subscriptionInfo: props.provider.subscriptionInfo,
        }),
        h('div', { class: 'flex flex-col gap-2' }, [
          h(
            'div',
            { class: 'text-sm text-slate-500' },
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
            })
          : h(ProxyNodeCard, {
              key: proxyName,
              proxyName,
              testUrl: props.provider.testUrl,
              timeout: props.provider.timeout ?? null,
            }),
      )
  },
})
</script>

<template>
  <div class="flex h-full flex-col gap-2">
    <!-- Tabs and Actions -->
    <div class="flex items-center gap-2">
      <div class="tabs-box tabs gap-2 tabs-sm">
        <button
          v-for="tab in tabs"
          :key="tab.type"
          class="sm:tab-md tab gap-2 px-2"
          :class="{ 'bg-primary text-neutral!': activeTab === tab.type }"
          @click="activeTab = tab.type"
        >
          <span>{{ tab.name }}</span>
          <div class="badge badge-sm">
            {{ tab.count }}
          </div>
        </button>
      </div>

      <Button
        v-if="activeTab === 'proxyProviders'"
        class="btn btn-circle btn-sm"
        :disabled="proxiesStore.isAllProviderUpdating"
        @click="proxiesStore.updateAllProvider"
      >
        <IconReload
          :class="{
            'animate-spin text-success': proxiesStore.isAllProviderUpdating,
          }"
        />
      </Button>

      <div class="ml-auto">
        <Button
          class="btn-circle btn-sm btn-primary"
          @click="settingsModal?.open()"
        >
          <IconSettings />
        </Button>
      </div>
    </div>

    <!-- Proxy Groups -->
    <div v-if="activeTab === 'proxies'" class="flex-1 overflow-y-auto">
      <ProxiesRenderWrapper ref="proxyGroupsWrapper">
        <template v-if="proxyGroupsWrapper?.isTwoColumns" #even>
          <Collapse
            v-for="(proxyGroup, index) in renderProxies.filter(
              (_, i) => i % 2 === 0,
            )"
            :key="proxyGroup.name"
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
            v-for="proxyGroup in renderProxies"
            :key="proxyGroup.name"
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

    <!-- Proxy Providers -->
    <div v-else class="flex-1 overflow-y-auto">
      <ProxiesRenderWrapper ref="providersWrapper">
        <template v-if="providersWrapper?.isTwoColumns" #even>
          <Collapse
            v-for="provider in proxiesStore.proxyProviders.filter(
              (_, i) => i % 2 === 0,
            )"
            :key="provider.name"
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
            v-for="provider in proxiesStore.proxyProviders.filter(
              (_, i) => i % 2 === 1,
            )"
            :key="provider.name"
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
            v-for="provider in proxiesStore.proxyProviders"
            :key="provider.name"
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
              class="toggle"
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
            class="input w-full"
            type="text"
          />
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('latencyTestTimeoutDuration') }} ({{ t('ms') }})
          </ConfigTitle>
          <input
            v-model.number="configStore.latencyTestTimeoutDuration"
            class="input w-full"
            type="number"
          />
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('proxiesSorting') }}
          </ConfigTitle>
          <select
            v-model="configStore.proxiesOrderingType"
            class="select w-full"
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
              class="toggle"
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
              class="toggle"
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
            class="select w-full"
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
            class="select w-full"
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
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('iconHeight') }}
          </ConfigTitle>
          <input
            v-model.number="configStore.iconHeight"
            class="input w-full"
            type="number"
          />

          <ConfigTitle with-divider>
            {{ t('iconMarginRight') }}
          </ConfigTitle>
          <input
            v-model.number="configStore.iconMarginRight"
            class="input w-full"
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
