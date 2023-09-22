import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { useNavigate } from '@solidjs/router'
import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
  onMount,
} from 'solid-js'
import { z } from 'zod'
import {
  fetchBackendConfigAPI,
  fetchBackendVersionAPI,
  flushFakeIPDataAPI,
  flushingFakeIPData,
  reloadConfigFileAPI,
  reloadingConfigFile,
  restartBackendAPI,
  restartingBackend,
  updateBackendConfigAPI,
  updateGEODatabasesAPI,
  updatingGEODatabases,
  upgradeBackendAPI,
  upgradingBackend,
} from '~/apis'
import { Button, ConfigTitle } from '~/components'
import { MODE_OPTIONS, ROUTES, themes } from '~/constants'
import { useI18n } from '~/i18n'
import {
  autoSwitchTheme,
  favDayTheme,
  favNightTheme,
  setAutoSwitchTheme,
  setFavDayTheme,
  setFavNightTheme,
  setSelectedEndpoint,
  setUseTwemoji,
  useRequest,
  useTwemoji,
} from '~/signals'
import type { DNSQuery } from '~/types'

const dnsQueryFormSchema = z.object({
  name: z.string(),
  type: z.string(),
})

const DNSQueryForm = () => {
  const { t } = useI18n()
  const request = useRequest()

  const { form, isSubmitting } = createForm<z.infer<typeof dnsQueryFormSchema>>(
    {
      extend: validator({ schema: dnsQueryFormSchema }),
      onSubmit: async (values) => {
        request
          .get('dns/query', {
            searchParams: { name: values.name, type: values.type },
          })
          .json<DNSQuery>()
          .then(({ Answer }) =>
            setDNSQueryResult(Answer?.map(({ data }) => data) || []),
          )
      },
    },
  )

  const [DNSQueryResult, setDNSQueryResult] = createSignal<string[]>([])

  return (
    <div class="flex flex-col">
      <form use:form={form} class="flex gap-2 sm:flex-row">
        <input
          type="search"
          name="name"
          class="input input-bordered min-w-0 flex-1"
        />

        <div class="flex items-center gap-2">
          <select name="type" class="select select-bordered">
            <option>A</option>
            <option>AAAA</option>
            <option>MX</option>
          </select>

          <Button type="submit" class="btn-primary" loading={isSubmitting()}>
            {t('dnsQuery')}
          </Button>
        </div>
      </form>

      <Show when={DNSQueryResult().length > 0}>
        <div class="flex flex-col p-4">
          <For each={DNSQueryResult()}>
            {(item) => <div class="py-2">{item}</div>}
          </For>
        </div>
      </Show>
    </div>
  )
}

const configFormSchema = z.object({
  port: z.number(),
  'socks-port': z.number(),
  'redir-port': z.number(),
  'tproxy-port': z.number(),
  'mixed-port': z.number(),
})

const ConfigForm = () => {
  const { t } = useI18n()
  const navigate = useNavigate()

  const portList = [
    {
      label: 'HTTP Port',
      key: 'port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI('port', Number(e.target.value), refetch),
    },
    {
      label: 'Socks Port',
      key: 'socks-port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI(
          'socks-port',
          Number(e.target.value),
          refetch,
        ),
    },
    {
      label: 'Redir Port',
      key: 'redir-port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI(
          'redir-port',
          Number(e.target.value),
          refetch,
        ),
    },
    {
      label: 'TProxy Port',
      key: 'tproxy-port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI(
          'tproxy-port',
          Number(e.target.value),
          refetch,
        ),
    },
    {
      label: 'Mixed Port',
      key: 'mixed-port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI(
          'mixed-port',
          Number(e.target.value),
          refetch,
        ),
    },
  ]

  const { form, setInitialValues, reset } = createForm<
    z.infer<typeof configFormSchema>
  >({ extend: validator({ schema: configFormSchema }) })

  const [configsData, { refetch }] = createResource(fetchBackendConfigAPI)

  createEffect(() => {
    const configs = configsData()

    if (configs) {
      setInitialValues(configs)
      reset()
    }
  })

  return (
    <div class="flex flex-col gap-4">
      <select
        class="select select-bordered"
        value={configsData()?.mode}
        onChange={(e) =>
          void updateBackendConfigAPI('mode', e.target.value, refetch)
        }
      >
        <option value={MODE_OPTIONS.Global}>{t('global')}</option>
        <option value={MODE_OPTIONS.Rule}>{t('rule')}</option>
        <option value={MODE_OPTIONS.Direct}>{t('direct')}</option>
      </select>

      <form class="grid grid-cols-3 gap-2 sm:grid-cols-5" use:form={form}>
        <For each={portList}>
          {(item) => (
            <div class="form-control">
              <label for={item.key} class="label">
                <span class="label-text">{item.label}</span>
              </label>

              <input
                id={item.key}
                name={item.key}
                type="number"
                class="input input-bordered"
                placeholder={item.label}
                onChange={item.onChange}
              />
            </div>
          )}
        </For>
      </form>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="form-control">
          <label for="enable-tun-device" class="label gap-2">
            <span class="label-text">{t('enableTunDevice')}</span>
          </label>

          <input
            id="enable-tun-device"
            type="checkbox"
            class="toggle"
            checked={configsData()?.tun.enable}
            onChange={(e) =>
              void updateBackendConfigAPI(
                'tun',
                { enable: e.target.checked },
                refetch,
              )
            }
          />
        </div>

        <div class="form-control">
          <label for="tun-ip-stack" class="label gap-2">
            <span class="label-text">{t('tunModeStack')}</span>
          </label>

          <select
            id="tun-ip-stack"
            class="select select-bordered flex-1"
            value={configsData()?.tun.stack}
            onChange={(e) =>
              void updateBackendConfigAPI(
                'tun',
                { stack: e.target.value },
                refetch,
              )
            }
          >
            <option>gVisor</option>
            <option>System</option>
            <option>LWIP</option>
          </select>
        </div>

        <div class="form-control">
          <label for="device-name" class="label gap-2">
            <span class="label-text">{t('tunDeviceName')}</span>
          </label>

          <input
            id="device-name"
            class="input input-bordered min-w-0"
            value={configsData()?.tun.device}
            onChange={(e) =>
              void updateBackendConfigAPI(
                'tun',
                { device: e.target.value },
                refetch,
              )
            }
          />
        </div>

        <div class="form-control">
          <label for="interface-name" class="label gap-2">
            <span class="label-text">{t('interfaceName')}</span>
          </label>

          <input
            id="interface-name"
            class="input input-bordered min-w-0"
            value={configsData()?.['interface-name']}
            onChange={(e) =>
              void updateBackendConfigAPI(
                'interface-name',
                e.target.value,
                refetch,
              )
            }
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button
          class="btn-primary"
          loading={reloadingConfigFile()}
          onClick={reloadConfigFileAPI}
        >
          {t('reloadConfig')}
        </Button>

        <Button
          class="btn-secondary"
          loading={updatingGEODatabases()}
          onClick={updateGEODatabasesAPI}
        >
          {t('updateGEODatabases')}
        </Button>

        <Button
          class="btn-accent"
          loading={flushingFakeIPData()}
          onClick={flushFakeIPDataAPI}
        >
          {t('flushFakeIP')}
        </Button>

        <Button
          class="btn-error"
          loading={upgradingBackend()}
          onClick={upgradeBackendAPI}
        >
          {t('upgradeCore')}
        </Button>

        <Button
          class="btn-warning"
          loading={restartingBackend()}
          onClick={restartBackendAPI}
        >
          {t('restartCore')}
        </Button>

        <Button
          class="btn-info"
          onClick={() => {
            setSelectedEndpoint('')
            navigate(ROUTES.Setup)
          }}
        >
          {t('switchEndpoint')}
        </Button>
      </div>
    </div>
  )
}

const ConfigForXd = () => {
  const { t } = useI18n()

  return (
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col items-center">
          <ConfigTitle>{t('autoSwitchTheme')}</ConfigTitle>

          <input
            type="checkbox"
            class="toggle"
            checked={autoSwitchTheme()}
            onChange={(e) => setAutoSwitchTheme(e.target.checked)}
          />
        </div>

        <Show when={autoSwitchTheme()}>
          <div class="flex flex-col gap-2">
            <div class="flex flex-col">
              <ConfigTitle>{t('favDayTheme')}</ConfigTitle>

              <select
                class="select select-bordered"
                onChange={(e) => setFavDayTheme(e.target.value)}
              >
                <For each={themes}>
                  {(theme) => (
                    <option selected={favDayTheme() === theme} value={theme}>
                      {theme}
                    </option>
                  )}
                </For>
              </select>
            </div>

            <div class="flex flex-col">
              <ConfigTitle>{t('favNightTheme')}</ConfigTitle>

              <select
                class="select select-bordered"
                onChange={(e) => setFavNightTheme(e.target.value)}
              >
                <For each={themes}>
                  {(theme) => (
                    <option selected={favNightTheme() === theme} value={theme}>
                      {theme}
                    </option>
                  )}
                </For>
              </select>
            </div>
          </div>
        </Show>
      </div>

      <div class="flex flex-col items-center">
        <ConfigTitle>{t('useTwemoji')}</ConfigTitle>

        <input
          type="checkbox"
          class="toggle"
          checked={useTwemoji()}
          onChange={(e) => setUseTwemoji(e.target.checked)}
        />
      </div>
    </div>
  )
}

const Versions = () => {
  const [backendVersion, setBackendVersion] = createSignal('')

  onMount(async () => {
    const version = await fetchBackendVersionAPI()

    setBackendVersion(version)
  })

  return (
    <div class="flex items-center justify-center gap-4">
      <kbd class="kbd">{import.meta.env.version}</kbd>
      <kbd class="kbd">{backendVersion()}</kbd>
    </div>
  )
}

export default () => {
  const { t } = useI18n()

  return (
    <div class="mx-auto flex max-w-screen-md flex-col gap-4">
      <ConfigTitle withDivider>{t('dnsQuery')}</ConfigTitle>

      <DNSQueryForm />

      <ConfigTitle withDivider>{t('coreConfig')}</ConfigTitle>

      <ConfigForm />

      <ConfigTitle withDivider>{t('xdConfig')}</ConfigTitle>

      <ConfigForXd />

      <ConfigTitle withDivider>{t('version')}</ConfigTitle>

      <Versions />
    </div>
  )
}
