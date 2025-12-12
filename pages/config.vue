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
</script>

<template>
  <div
    class="mx-auto flex h-full max-w-3xl flex-col gap-4 overflow-y-auto px-2 pb-2"
  >
    <!-- Loading State -->
    <div v-if="isLoading" class="flex h-64 items-center justify-center">
      <span class="loading loading-lg loading-spinner" />
    </div>

    <template v-else>
      <!-- DNS Query (hide for sing-box) -->
      <template v-if="!isSingBox">
        <ConfigTitle with-divider>
          {{ t('dnsQuery') }}
        </ConfigTitle>

        <div class="flex flex-col">
          <form class="join" @submit.prevent="onDnsQuery">
            <input
              v-model="dnsQuery.name"
              type="search"
              class="input join-item w-full"
              placeholder="google.com"
              @input="onDnsQueryInput"
            />

            <select v-model="dnsQuery.type" class="select join-item max-w-max">
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
              class="join-item max-w-max btn-primary"
              :loading="dnsQueryMutation.isPending.value"
            >
              {{ t('dnsQuery') }}
            </Button>
          </form>

          <div
            v-if="dnsQueryResult.length > 0"
            class="flex flex-col overflow-auto p-4"
          >
            <div v-for="item in dnsQueryResult" :key="item" class="py-2">
              {{ item }}
            </div>
          </div>
        </div>
      </template>

      <!-- Core Config -->
      <ConfigTitle with-divider>
        {{ t('coreConfig') }}
      </ConfigTitle>

      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-3 gap-2">
          <fieldset class="fieldset">
            <label class="label truncate" for="enable-allow-lan">{{
              t('allowLan')
            }}</label>
            <input
              id="enable-allow-lan"
              v-model="localConfig.allowLan"
              type="checkbox"
              class="toggle"
              @change="updateConfig('allow-lan', localConfig.allowLan)"
            />
          </fieldset>

          <fieldset class="fieldset">
            <label class="label truncate" for="mode">{{
              t('runningMode')
            }}</label>
            <select
              id="mode"
              v-model="localConfig.mode"
              class="select"
              @change="updateConfig('mode', localConfig.mode)"
            >
              <option v-for="mode in modes" :key="mode" :value="mode">
                {{ getModeLabel(mode) }}
              </option>
            </select>
          </fieldset>

          <fieldset class="fieldset">
            <label class="label truncate" for="interface-name">{{
              t('outboundInterfaceName')
            }}</label>
            <input
              id="interface-name"
              v-model="localConfig.interfaceName"
              type="text"
              class="input min-w-0"
              @change="
                updateConfig('interface-name', localConfig.interfaceName)
              "
            />
          </fieldset>
        </div>

        <!-- TUN settings (hide for sing-box) -->
        <template v-if="!isSingBox">
          <div class="grid grid-cols-3 gap-2">
            <fieldset class="fieldset">
              <label class="label truncate" for="enable-tun-device">{{
                t('enableTunDevice')
              }}</label>
              <input
                id="enable-tun-device"
                v-model="localConfig.tunEnable"
                type="checkbox"
                class="toggle"
                @change="updateConfig('tun', { enable: localConfig.tunEnable })"
              />
            </fieldset>

            <fieldset class="fieldset">
              <label class="label truncate" for="tun-ip-stack">{{
                t('tunModeStack')
              }}</label>
              <select
                id="tun-ip-stack"
                v-model="localConfig.tunStack"
                class="select"
                @change="updateConfig('tun', { stack: localConfig.tunStack })"
              >
                <option v-for="stack in tunStacks" :key="stack" :value="stack">
                  {{ stack }}
                </option>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <label class="label truncate" for="device-name">{{
                t('tunDeviceName')
              }}</label>
              <input
                id="device-name"
                v-model="localConfig.tunDevice"
                type="text"
                class="input min-w-0"
                @change="updateConfig('tun', { device: localConfig.tunDevice })"
              />
            </fieldset>
          </div>

          <!-- Port settings -->
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <fieldset v-for="port in portList" :key="port.key" class="fieldset">
              <label class="label truncate" :for="port.key">{{
                port.label
              }}</label>
              <input
                :id="port.key"
                v-model.number="localConfig[port.key]"
                type="number"
                class="input min-w-0"
                :placeholder="port.label"
                @change="updateConfig(port.configKey, localConfig[port.key])"
              />
            </fieldset>
          </div>
        </template>

        <div class="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <Button
            class="btn-primary"
            :loading="configActions.reloadingConfigFile.value"
            @click="configActions.reloadConfigFileAPI"
          >
            {{ t('reloadConfig') }}
          </Button>

          <Button
            class="btn-warning"
            :loading="configActions.restartingBackend.value"
            @click="configActions.restartBackendAPI"
          >
            {{ t('restartCore') }}
          </Button>

          <Button
            class="btn-accent"
            :loading="configActions.flushingFakeIPData.value"
            @click="configActions.flushFakeIPDataAPI"
          >
            {{ t('flushFakeIP') }}
          </Button>

          <Button
            class="btn-info"
            :loading="configActions.flushingDNSCache.value"
            @click="configActions.flushDNSCacheAPI"
          >
            {{ t('flushDNSCache') }}
          </Button>

          <Button
            v-if="!isSingBox"
            class="btn-secondary"
            :loading="configActions.updatingGEODatabases.value"
            @click="configActions.updateGEODatabasesAPI"
          >
            {{ t('updateGEODatabases') }}
          </Button>
        </div>
      </div>

      <!-- XD Config -->
      <ConfigTitle with-divider>
        {{ t('xdConfig') }}
      </ConfigTitle>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <div class="flex flex-col">
            <ConfigTitle>{{ t('enableTwemoji') }}</ConfigTitle>
            <input
              v-model="configStore.enableTwemoji"
              type="checkbox"
              class="toggle"
            />
          </div>

          <div class="flex flex-col items-center">
            <ConfigTitle>{{ t('autoSwitchEndpoint') }}</ConfigTitle>
            <div class="h-10">
              <input
                v-model="configStore.autoSwitchEndpoint"
                type="checkbox"
                class="toggle"
              />
            </div>
          </div>

          <div class="flex flex-col">
            <ConfigTitle>{{ endpointStore.currentEndpoint?.url }}</ConfigTitle>
            <Button class="btn-info" @click="switchEndpoint">
              {{ t('switchEndpoint') }}
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex flex-col items-center">
            <ConfigTitle>{{ t('autoSwitchTheme') }}</ConfigTitle>
            <div class="h-10">
              <input
                v-model="configStore.autoSwitchTheme"
                type="checkbox"
                class="toggle"
              />
            </div>
          </div>

          <template v-if="configStore.autoSwitchTheme">
            <div class="flex flex-col gap-2">
              <div class="flex flex-col">
                <ConfigTitle>{{ t('favDayTheme') }}</ConfigTitle>
                <ThemeSelector v-model="configStore.favDayTheme" />
              </div>

              <div class="flex flex-col">
                <ConfigTitle>{{ t('favNightTheme') }}</ConfigTitle>
                <ThemeSelector v-model="configStore.favNightTheme" />
              </div>
            </div>
          </template>
        </div>

        <div class="col-span-1 flex flex-col gap-2 sm:col-span-2">
          <Button class="btn-error" @click="configStore.resetXdConfig()">
            {{ t('resetSettings') }}
          </Button>
        </div>
      </div>

      <!-- Version -->
      <ConfigTitle with-divider>
        {{ t('version') }}
      </ConfigTitle>

      <Versions
        :frontend-version="frontendVersion"
        :backend-version="backendVersion || ''"
      />
    </template>
  </div>
</template>
