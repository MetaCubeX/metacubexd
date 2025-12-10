<script setup lang="ts">
import type { Config, DNSQuery } from '~/types'
import {
  fetchBackendConfigAPI,
  fetchBackendVersionAPI,
  updateBackendConfigAPI,
  useConfigActions,
  useRequest,
} from '~/composables/useApi'
import { themes } from '~/constants'

useHead({ title: 'Config' })

const { t } = useI18n()
const router = useRouter()
const configStore = useConfigStore()
const endpointStore = useEndpointStore()

const configActions = useConfigActions()
const runtimeConfig = useRuntimeConfig()

const frontendVersion = `v${runtimeConfig.public.appVersion || '0.0.0'}`
const backendVersion = ref('')
const isLoadingVersion = ref(true)

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
const dnsQueryLoading = ref(false)
const dnsQueryResult = ref<string[]>([])

function onDnsQueryInput() {
  if (!dnsQuery.name) dnsQueryResult.value = []
}

async function onDnsQuery() {
  dnsQueryLoading.value = true
  try {
    const request = useRequest()
    const result = await request
      .get('dns/query', {
        searchParams: {
          name: dnsQuery.name || 'google.com',
          type: dnsQuery.type,
        },
      })
      .json<DNSQuery>()

    dnsQueryResult.value = result.Answer?.map(({ data }) => data) || []
  } catch (err) {
    console.error(err)
  } finally {
    dnsQueryLoading.value = false
  }
}

// Backend Config
const backendConfig = reactive({
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
  // Try to translate known modes
  const knownModes = ['rule', 'direct', 'global']
  if (knownModes.includes(mode)) {
    return t(mode as any) || mode
  }
  return mode
}

async function loadBackendConfig() {
  try {
    const config = await fetchBackendConfigAPI()
    backendConfig.allowLan = config['allow-lan'] || false
    backendConfig.mode = config.mode || 'rule'
    backendConfig.interfaceName = config['interface-name'] || ''
    backendConfig.tunEnable = config.tun?.enable || false
    backendConfig.tunStack = config.tun?.stack || 'Mixed'
    backendConfig.tunDevice = config.tun?.device || ''
    backendConfig.mixedPort = config['mixed-port'] || 0
    backendConfig.port = config.port || 0
    backendConfig.socksPort = config['socks-port'] || 0
    backendConfig.redirPort = config['redir-port'] || 0
    backendConfig.tproxyPort = config['tproxy-port'] || 0
    modes.value = config['mode-list'] ||
      config.modes || ['rule', 'direct', 'global']
  } catch (err) {
    console.error(err)
  }
}

async function updateConfig(key: keyof Config | string, value: unknown) {
  try {
    await updateBackendConfigAPI(key as keyof Config, value as any)
  } catch (err) {
    console.error(err)
  }
}

function switchEndpoint() {
  endpointStore.setSelectedEndpoint('')
  router.push('/setup')
}

// Load data on mount
onMounted(async () => {
  await loadBackendConfig()
  try {
    backendVersion.value = await fetchBackendVersionAPI()
  } catch (err) {
    console.error(err)
  } finally {
    isLoadingVersion.value = false
  }
})
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-4">
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
            :loading="dnsQueryLoading"
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
            v-model="backendConfig.allowLan"
            type="checkbox"
            class="toggle"
            @change="updateConfig('allow-lan', backendConfig.allowLan)"
          />
        </fieldset>

        <fieldset class="fieldset">
          <label class="label truncate" for="mode">{{
            t('runningMode')
          }}</label>
          <select
            id="mode"
            v-model="backendConfig.mode"
            class="select"
            @change="updateConfig('mode', backendConfig.mode)"
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
            v-model="backendConfig.interfaceName"
            type="text"
            class="input min-w-0"
            @change="
              updateConfig('interface-name', backendConfig.interfaceName)
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
              v-model="backendConfig.tunEnable"
              type="checkbox"
              class="toggle"
              @change="updateConfig('tun', { enable: backendConfig.tunEnable })"
            />
          </fieldset>

          <fieldset class="fieldset">
            <label class="label truncate" for="tun-ip-stack">{{
              t('tunModeStack')
            }}</label>
            <select
              id="tun-ip-stack"
              v-model="backendConfig.tunStack"
              class="select"
              @change="updateConfig('tun', { stack: backendConfig.tunStack })"
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
              v-model="backendConfig.tunDevice"
              type="text"
              class="input min-w-0"
              @change="updateConfig('tun', { device: backendConfig.tunDevice })"
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
              v-model.number="backendConfig[port.key]"
              type="number"
              class="input min-w-0"
              :placeholder="port.label"
              @change="updateConfig(port.configKey, backendConfig[port.key])"
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
          <ConfigTitle>{{ t('switchFont') }}</ConfigTitle>
          <select v-model="configStore.fontFamily" class="select w-full">
            <option value="font-system-ui">SystemUI</option>
            <option value="font-fira-sans">FiraSans</option>
          </select>
        </div>

        <div class="flex flex-col">
          <ConfigTitle>{{ t('switchLanguage') }}</ConfigTitle>
          <select v-model="configStore.locale" class="select w-full">
            <option value="en-US">English</option>
            <option value="zh-CN">简体中文</option>
            <option value="ru-RU">Русский</option>
          </select>
        </div>

        <div class="flex flex-col">
          <ConfigTitle>{{ endpointStore.currentEndpoint?.url }}</ConfigTitle>
          <Button class="btn-info" @click="switchEndpoint">
            {{ t('switchEndpoint') }}
          </Button>
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
              <select v-model="configStore.favDayTheme" class="select w-full">
                <option v-for="theme in themes" :key="theme" :value="theme">
                  {{ theme }}
                </option>
              </select>
            </div>

            <div class="flex flex-col">
              <ConfigTitle>{{ t('favNightTheme') }}</ConfigTitle>
              <select v-model="configStore.favNightTheme" class="select w-full">
                <option v-for="theme in themes" :key="theme" :value="theme">
                  {{ theme }}
                </option>
              </select>
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
      v-if="!isLoadingVersion"
      :frontend-version="frontendVersion"
      :backend-version="backendVersion"
    />
  </div>
</template>
