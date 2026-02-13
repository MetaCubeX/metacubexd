<script setup lang="ts">
import type { Config, DNSQuery } from '~/types'
import { useMutation } from '@tanstack/vue-query'
import { useConfigActions, useRequest } from '~/composables/useApi'
import {
  useConfigQuery,
  useUpdateConfigMutation,
  useVersionQuery,
} from '~/composables/useQueries'

const { t } = useI18n()
const nodeRecommendationStore = useNodeRecommendationStore()

useHead({ title: computed(() => t('config')) })
const router = useRouter()
const configStore = useConfigStore()
const endpointStore = useEndpointStore()

const configActions = useConfigActions()
const runtimeConfig = useRuntimeConfig()

const frontendVersion = `v${runtimeConfig.public.appVersion || '0.0.0'}`

// TanStack Query
const { data: backendConfig, isLoading: isLoadingConfig } = useConfigQuery()
const { data: backendVersion, isLoading: isLoadingVersion } = useVersionQuery()
const updateConfigMutation = useUpdateConfigMutation()

// Check if sing-box backend
const isSingBox = computed(
  () => backendVersion.value?.includes('sing-box') || false,
)

// TUN stack options
const tunStacks = ['Mixed', 'gVisor', 'System', 'LWIP']

// DNS Query
const dnsQuery = reactive({
  name: '',
  type: 'A',
})
const dnsQueryResult = ref<string[]>([])

const dnsQueryMutation = useMutation({
  mutationFn: async ({ name, type }: { name: string; type: string }) => {
    const request = useRequest()
    const result = await request
      .get('dns/query', {
        searchParams: { name: name || 'google.com', type },
      })
      .json<DNSQuery>()
    return result.Answer?.map(({ data }) => data) || []
  },
  onSuccess: (data) => {
    dnsQueryResult.value = data
  },
})

function onDnsQueryInput() {
  if (!dnsQuery.name) dnsQueryResult.value = []
}

function onDnsQuery() {
  dnsQueryMutation.mutate({ name: dnsQuery.name, type: dnsQuery.type })
}

// Remote config URL
const remoteConfigURL = ref('')

async function onFetchRemoteConfig() {
  if (!remoteConfigURL.value) return
  try {
    await configActions.fetchRemoteConfigAPI(remoteConfigURL.value)
  } catch {
    /* error already logged in API */
  }
}

// Local state for form inputs (synced from query data)
const localConfig = reactive({
  allowLan: false,
  mode: 'rule',
  interfaceName: '',
  tunEnable: false,
  tunStack: 'Mixed',
  tunDevice: '',
  mixedPort: 0,
  port: 0,
  socksPort: 0,
  redirPort: 0,
  tproxyPort: 0,
})

const modes = ref<string[]>(['rule', 'direct', 'global'])

// Sync backend config to local state
watch(
  backendConfig,
  (config) => {
    if (config) {
      localConfig.allowLan = config['allow-lan'] || false
      localConfig.mode = config.mode || 'rule'
      localConfig.interfaceName = config['interface-name'] || ''
      localConfig.tunEnable = config.tun?.enable || false
      localConfig.tunStack = config.tun?.stack || 'Mixed'
      localConfig.tunDevice = config.tun?.device || ''
      localConfig.mixedPort = config['mixed-port'] || 0
      localConfig.port = config.port || 0
      localConfig.socksPort = config['socks-port'] || 0
      localConfig.redirPort = config['redir-port'] || 0
      localConfig.tproxyPort = config['tproxy-port'] || 0
      modes.value = config['mode-list'] ||
        config.modes || ['rule', 'direct', 'global']
    }
  },
  { immediate: true },
)

const portList = computed(() => [
  {
    label: t('port', { name: 'Mixed' }),
    key: 'mixedPort' as const,
    configKey: 'mixed-port' as const,
  },
  {
    label: t('port', { name: 'HTTP' }),
    key: 'port' as const,
    configKey: 'port' as const,
  },
  {
    label: t('port', { name: 'Socks' }),
    key: 'socksPort' as const,
    configKey: 'socks-port' as const,
  },
  {
    label: t('port', { name: 'Redir' }),
    key: 'redirPort' as const,
    configKey: 'redir-port' as const,
  },
  {
    label: t('port', { name: 'TProxy' }),
    key: 'tproxyPort' as const,
    configKey: 'tproxy-port' as const,
  },
])

function getModeLabel(mode: string) {
  const knownModes = ['rule', 'direct', 'global']
  if (knownModes.includes(mode)) {
    return t(mode as any) || mode
  }
  return mode
}

function updateConfig(key: keyof Config | string, value: unknown) {
  updateConfigMutation.mutate({ key: key as keyof Config, value: value as any })
}

function switchEndpoint() {
  endpointStore.setSelectedEndpoint('')
  router.push('/setup')
}

const isLoading = computed(
  () => isLoadingConfig.value || isLoadingVersion.value,
)

// Active section for mobile tabs
const activeSection = ref<'core' | 'xd' | 'tools'>('core')
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex h-64 items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <span class="loading loading-lg loading-ring text-primary" />
        <span class="text-sm opacity-60">{{ t('config') }}</span>
      </div>
    </div>

    <template v-else>
      <!-- Header with Version Info -->
      <div
        class="animate-fade-slide-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="animate-pulse-subtle flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M12 1v6m0 6v10M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m6 0h10M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"
              />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight">{{ t('config') }}</h1>
            <p class="text-xs opacity-60">
              {{ endpointStore.currentEndpoint?.url }}
            </p>
          </div>
        </div>
        <Versions
          :frontend-version="frontendVersion"
          :backend-version="backendVersion || ''"
        />
      </div>

      <!-- Mobile Section Tabs -->
      <div class="flex gap-1 rounded-lg bg-base-200 p-1 sm:hidden">
        <button
          class="tab"
          :class="{ 'tab-active': activeSection === 'core' }"
          @click="activeSection = 'core'"
        >
          {{ t('coreConfig') }}
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': activeSection === 'xd' }"
          @click="activeSection = 'xd'"
        >
          {{ t('xdConfig') }}
        </button>
        <button
          v-if="!isSingBox"
          class="tab"
          :class="{ 'tab-active': activeSection === 'tools' }"
          @click="activeSection = 'tools'"
        >
          {{ t('dnsQuery') }}
        </button>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Core Config Card -->
        <div
          class="config-card animate-fade-slide-in-1 hidden sm:block"
          :class="{ '!block': activeSection === 'core' }"
        >
          <div
            class="flex items-center gap-2 border-b border-base-content/5 bg-base-300/30 px-4 py-3 text-sm font-semibold"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              />
            </svg>
            <span>{{ t('coreConfig') }}</span>
          </div>

          <div class="flex flex-col gap-3 p-4">
            <!-- Basic Settings -->
            <div class="flex flex-col gap-2">
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-4 opacity-60"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    />
                  </svg>
                  <span>{{ t('allowLan') }}</span>
                </div>
                <input
                  id="enable-allow-lan"
                  v-model="localConfig.allowLan"
                  type="checkbox"
                  class="toggle toggle-primary"
                  @change="updateConfig('allow-lan', localConfig.allowLan)"
                />
              </div>

              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-4 opacity-60"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span>{{ t('runningMode') }}</span>
                </div>
                <select
                  id="mode"
                  v-model="localConfig.mode"
                  class="select-bordered select w-32 select-sm"
                  @change="updateConfig('mode', localConfig.mode)"
                >
                  <option v-for="mode in modes" :key="mode" :value="mode">
                    {{ getModeLabel(mode) }}
                  </option>
                </select>
              </div>

              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-4 opacity-60"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  <span>{{ t('outboundInterfaceName') }}</span>
                </div>
                <input
                  id="interface-name"
                  v-model="localConfig.interfaceName"
                  type="text"
                  class="input-bordered input input-sm w-32"
                  @change="
                    updateConfig('interface-name', localConfig.interfaceName)
                  "
                />
              </div>
            </div>

            <!-- TUN Settings (hide for sing-box) -->
            <template v-if="!isSingBox">
              <div class="divider my-2 text-xs opacity-40">TUN</div>
              <div class="flex flex-col gap-2">
                <div
                  class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="size-4 opacity-60"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"
                      />
                    </svg>
                    <span>{{ t('enableTunDevice') }}</span>
                  </div>
                  <input
                    id="enable-tun-device"
                    v-model="localConfig.tunEnable"
                    type="checkbox"
                    class="toggle toggle-primary"
                    @change="
                      updateConfig('tun', { enable: localConfig.tunEnable })
                    "
                  />
                </div>

                <div
                  class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <span class="pl-5">{{ t('tunModeStack') }}</span>
                  </div>
                  <select
                    id="tun-ip-stack"
                    v-model="localConfig.tunStack"
                    class="select-bordered select w-32 select-sm"
                    @change="
                      updateConfig('tun', { stack: localConfig.tunStack })
                    "
                  >
                    <option
                      v-for="stack in tunStacks"
                      :key="stack"
                      :value="stack"
                    >
                      {{ stack }}
                    </option>
                  </select>
                </div>

                <div
                  class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <span class="pl-5">{{ t('tunDeviceName') }}</span>
                  </div>
                  <input
                    id="device-name"
                    v-model="localConfig.tunDevice"
                    type="text"
                    class="input-bordered input input-sm w-32"
                    @change="
                      updateConfig('tun', { device: localConfig.tunDevice })
                    "
                  />
                </div>
              </div>

              <!-- Port Settings -->
              <div class="divider my-2 text-xs opacity-40">PORTS</div>
              <div class="flex flex-col gap-2">
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <fieldset
                    v-for="port in portList"
                    :key="port.key"
                    class="fieldset"
                  >
                    <label class="label text-xs opacity-70" :for="port.key">
                      {{ port.label }}
                    </label>
                    <input
                      :id="port.key"
                      v-model.number="localConfig[port.key]"
                      type="number"
                      class="input-bordered input input-sm w-full font-mono"
                      :placeholder="port.label"
                      @change="
                        updateConfig(port.configKey, localConfig[port.key])
                      "
                    />
                  </fieldset>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- XD Config Card -->
        <div
          class="config-card animate-fade-slide-in-2 hidden sm:block"
          :class="{ '!block': activeSection === 'xd' }"
        >
          <div
            class="flex items-center gap-2 border-b border-base-content/5 bg-base-300/30 px-4 py-3 text-sm font-semibold"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
            </svg>
            <span>{{ t('xdConfig') }}</span>
          </div>

          <div class="flex flex-col gap-3 p-4">
            <div class="flex flex-col gap-2">
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('enableTwemoji') }}</span>
                </div>
                <input
                  v-model="configStore.enableTwemoji"
                  type="checkbox"
                  class="toggle toggle-primary"
                />
              </div>

              <!-- Mobile Bottom Nav Toggle - only visible on mobile -->
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5 lg:hidden"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('useMobileBottomNav') }}</span>
                </div>
                <input
                  v-model="configStore.useMobileBottomNav"
                  type="checkbox"
                  class="toggle toggle-primary"
                />
              </div>

              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('autoSwitchEndpoint') }}</span>
                </div>
                <input
                  v-model="configStore.autoSwitchEndpoint"
                  type="checkbox"
                  class="toggle toggle-primary"
                />
              </div>

              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('autoSwitchTheme') }}</span>
                </div>
                <input
                  v-model="configStore.autoSwitchTheme"
                  type="checkbox"
                  class="toggle toggle-primary"
                />
              </div>

              <template v-if="configStore.autoSwitchTheme">
                <div
                  class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <span class="pl-4 text-sm opacity-70">{{
                      t('favDayTheme')
                    }}</span>
                  </div>
                  <ThemeSelector v-model="configStore.favDayTheme" />
                </div>
                <div
                  class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <span class="pl-4 text-sm opacity-70">{{
                      t('favNightTheme')
                    }}</span>
                  </div>
                  <ThemeSelector v-model="configStore.favNightTheme" />
                </div>
              </template>
            </div>

            <div class="divider my-2 text-xs opacity-40">
              {{ t('shortcuts.title', 'Keyboard Shortcuts') }}
            </div>

            <ShortcutsSettings />

            <div class="divider my-2 text-xs opacity-40">
              {{ t('recommendation.title', 'Smart Recommendation') }}
            </div>

            <!-- Recommendation Settings -->
            <div class="flex flex-col gap-2">
              <!-- Auto Switch Toggle -->
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm">{{
                    t('recommendation.autoSwitch')
                  }}</span>
                  <span class="text-xs opacity-50">{{
                    t('recommendation.autoSwitchDesc')
                  }}</span>
                </div>
                <input
                  v-model="nodeRecommendationStore.autoSwitchEnabled"
                  type="checkbox"
                  class="toggle toggle-primary"
                />
              </div>

              <!-- Latency Weight -->
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('recommendation.latencyWeight') }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="
                      nodeRecommendationStore.scoringWeights.latency
                    "
                    type="range"
                    min="0"
                    max="100"
                    class="range w-24 range-primary range-xs"
                  />
                  <span class="w-8 text-right font-mono text-xs"
                    >{{ nodeRecommendationStore.scoringWeights.latency }}%</span
                  >
                </div>
              </div>

              <!-- Stability Weight -->
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('recommendation.stabilityWeight') }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="
                      nodeRecommendationStore.scoringWeights.stability
                    "
                    type="range"
                    min="0"
                    max="100"
                    class="range w-24 range-secondary range-xs"
                  />
                  <span class="w-8 text-right font-mono text-xs"
                    >{{
                      nodeRecommendationStore.scoringWeights.stability
                    }}%</span
                  >
                </div>
              </div>

              <!-- Success Rate Weight -->
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('recommendation.successRateWeight') }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="
                      nodeRecommendationStore.scoringWeights.successRate
                    "
                    type="range"
                    min="0"
                    max="100"
                    class="range w-24 range-accent range-xs"
                  />
                  <span class="w-8 text-right font-mono text-xs"
                    >{{
                      nodeRecommendationStore.scoringWeights.successRate
                    }}%</span
                  >
                </div>
              </div>

              <!-- Min Test Interval -->
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('recommendation.minTestInterval') }}</span>
                </div>
                <input
                  v-model.number="nodeRecommendationStore.minTestInterval"
                  type="number"
                  min="1"
                  max="60"
                  class="input-bordered input input-sm w-20 text-center"
                />
              </div>

              <!-- Excluded Nodes Count -->
              <div
                class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
              >
                <div class="flex items-center gap-2 text-sm">
                  <span>{{ t('recommendation.excludedNodes') }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-neutral">{{
                    nodeRecommendationStore.excludedNodes.length
                  }}</span>
                  <button
                    v-if="nodeRecommendationStore.excludedNodes.length > 0"
                    class="btn btn-ghost btn-xs"
                    @click="nodeRecommendationStore.excludedNodes = []"
                  >
                    {{ t('clearAll') }}
                  </button>
                </div>
              </div>

              <!-- Clear History Button -->
              <Button
                class="mt-2 w-full btn-outline btn-warning"
                @click="nodeRecommendationStore.clearAllData()"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                  />
                </svg>
                {{ t('recommendation.clearHistory') }}
              </Button>
            </div>

            <div class="divider my-2 text-xs opacity-40">ENDPOINT</div>

            <div class="flex flex-col gap-2">
              <Button
                class="w-full btn-outline btn-info"
                @click="switchEndpoint"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
                {{ t('switchEndpoint') }}
              </Button>

              <Button
                class="w-full btn-outline btn-error"
                @click="configStore.resetXdConfig()"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                {{ t('resetSettings') }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Actions Card (Full Width) -->
        <div
          class="config-card animate-fade-slide-in-3 col-span-1 lg:col-span-2"
        >
          <div
            class="flex items-center gap-2 border-b border-base-content/5 bg-base-300/30 px-4 py-3 text-sm font-semibold"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
              />
            </svg>
            <span>{{ t('coreConfig') }} - Actions</span>
          </div>

          <div class="flex flex-col gap-3 p-4">
            <!-- Remote Config URL -->
            <form
              class="flex flex-col gap-2 sm:flex-row"
              @submit.prevent="onFetchRemoteConfig"
            >
              <input
                v-model="remoteConfigURL"
                type="url"
                class="input-bordered input flex-1"
                :placeholder="t('remoteConfigURLPlaceholder')"
              />
              <Button
                type="submit"
                class="btn-secondary"
                :loading="configActions.fetchingRemoteConfig.value"
                :disabled="!remoteConfigURL"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                  />
                </svg>
                {{ t('fetchRemoteConfig') }}
              </Button>
            </form>

            <div class="divider my-3" />

            <!-- Action Buttons Grid -->
            <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Button
                class="btn-primary"
                :loading="configActions.reloadingConfigFile.value"
                @click="configActions.reloadConfigFileAPI"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
                  />
                </svg>
                {{ t('reloadConfig') }}
              </Button>

              <Button
                class="btn-warning"
                :loading="configActions.restartingBackend.value"
                @click="configActions.restartBackendAPI"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {{ t('restartCore') }}
              </Button>

              <Button
                class="btn-accent"
                :loading="configActions.flushingFakeIPData.value"
                @click="configActions.flushFakeIPDataAPI"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                  />
                </svg>
                {{ t('flushFakeIP') }}
              </Button>

              <Button
                class="btn-info"
                :loading="configActions.flushingDNSCache.value"
                @click="configActions.flushDNSCacheAPI"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                {{ t('flushDNSCache') }}
              </Button>

              <Button
                v-if="!isSingBox"
                class="btn-secondary"
                :loading="configActions.updatingGEODatabases.value"
                @click="configActions.updateGEODatabasesAPI"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path
                    d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
                  />
                </svg>
                {{ t('updateGEODatabases') }}
              </Button>
            </div>
          </div>
        </div>

        <!-- DNS Query Card (hide for sing-box) -->
        <template v-if="!isSingBox">
          <div
            class="config-card animate-fade-slide-in-4 col-span-1 hidden sm:block lg:col-span-2"
            :class="{ '!block': activeSection === 'tools' }"
          >
            <div
              class="flex items-center gap-2 border-b border-base-content/5 bg-base-300/30 px-4 py-3 text-sm font-semibold"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span>{{ t('dnsQuery') }}</span>
            </div>

            <div class="flex flex-col gap-3 p-4">
              <form
                class="flex flex-col gap-3 sm:flex-row"
                @submit.prevent="onDnsQuery"
              >
                <input
                  v-model="dnsQuery.name"
                  type="search"
                  class="input-bordered input flex-1 font-mono"
                  placeholder="google.com"
                  @input="onDnsQueryInput"
                />

                <select
                  v-model="dnsQuery.type"
                  class="select-bordered select w-full sm:w-auto"
                >
                  <option>A</option>
                  <option>AAAA</option>
                  <option>CNAME</option>
                  <option>TXT</option>
                  <option>MX</option>
                  <option>SRV</option>
                  <option>HTTPS</option>
                  <option>NS</option>
                  <option>DNSKEY</option>
                  <option>DS</option>
                  <option>SIG</option>
                  <option>SOA</option>
                  <option>RRSIG</option>
                  <option>RP</option>
                </select>

                <Button
                  type="submit"
                  class="btn-primary"
                  :loading="dnsQueryMutation.isPending.value"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  {{ t('dnsQuery') }}
                </Button>
              </form>

              <!-- DNS Results -->
              <div
                v-if="dnsQueryResult.length > 0"
                class="mt-4 flex flex-col gap-1 rounded-xl bg-base-300/50 p-3"
              >
                <div
                  v-for="(item, index) in dnsQueryResult"
                  :key="item"
                  class="animate-slide-in rounded-lg bg-base-content/5 px-3 py-2"
                  :style="{ animationDelay: `${index * 50}ms` }"
                >
                  <span class="font-mono text-sm">{{ item }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Card base styles - using color-mix which isn't available in Tailwind */
.config-card {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid
    color-mix(in oklch, var(--color-base-content) 10%, transparent);
  backdrop-filter: blur(4px);
  transition: all 0.3s;
  background-color: color-mix(in oklch, var(--color-base-200) 50%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in oklch, var(--color-primary) 20%, transparent),
    0 4px 24px -4px color-mix(in oklch, var(--color-primary) 10%, transparent);
}

.config-card:hover {
  border-color: color-mix(in oklch, var(--color-primary) 30%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in oklch, var(--color-primary) 30%, transparent),
    0 8px 32px -4px color-mix(in oklch, var(--color-primary) 10%, transparent);
}

/* Animations */
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulseSubtle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-fade-slide-in {
  animation: fadeSlideIn 0.4s ease-out;
}

.animate-fade-slide-in-1 {
  animation: fadeSlideIn 0.5s ease-out backwards;
  animation-delay: 0.1s;
}

.animate-fade-slide-in-2 {
  animation: fadeSlideIn 0.5s ease-out backwards;
  animation-delay: 0.15s;
}

.animate-fade-slide-in-3 {
  animation: fadeSlideIn 0.5s ease-out backwards;
  animation-delay: 0.2s;
}

.animate-fade-slide-in-4 {
  animation: fadeSlideIn 0.5s ease-out backwards;
  animation-delay: 0.25s;
}

.animate-slide-in {
  animation: slideIn 0.3s ease-out backwards;
}

.animate-pulse-subtle {
  animation: pulseSubtle 3s ease-in-out infinite;
}
</style>
