import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import type { Accessor, Component } from 'solid-js'
import { toast } from 'solid-toast'
import { z } from 'zod'
import {
  fetchBackendConfigAPI,
  flushFakeIPDataAPI,
  flushingFakeIPData,
  isUpdateAvailableAPI,
  reloadConfigFileAPI,
  reloadingConfigFile,
  restartBackendAPI,
  restartingBackend,
  updateBackendConfigAPI,
  updateGEODatabasesAPI,
  updatingGEODatabases,
  upgradeBackendAPI,
  upgradeUIAPI,
  upgradingBackend,
  upgradingUI,
} from '~/apis'
import { Button, ConfigTitle } from '~/components'
import { LANG, ROUTES, themes } from '~/constants'
import { locale, setLocale, useI18n } from '~/i18n'
import {
  autoSwitchTheme,
  endpoint,
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
import {
  backendVersion,
  isSingBox,
  updateBackendVersion,
} from '~/signals/version'
import type { DNSQuery } from '~/types'

const dnsQueryFormSchema = z.object({
  name: z.string(),
  type: z.string(),
})

const DNSQueryForm = () => {
  const [t] = useI18n()
  const request = useRequest()

  const { form, isSubmitting } = createForm<z.infer<typeof dnsQueryFormSchema>>(
    {
      extend: validator({ schema: dnsQueryFormSchema }),
      onSubmit: (values) =>
        request
          .get('dns/query', {
            searchParams: { name: values.name, type: values.type },
          })
          .json<DNSQuery>()
          .then(({ Answer }) =>
            setDNSQueryResult(Answer?.map(({ data }) => data) || []),
          )
          .catch((err) => toast.error(err.message)),
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
          placeholder="google.com"
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
  const [t] = useI18n()

  const portList = [
    {
      label: () => t('port', { name: 'Mixed' }),
      key: 'mixed-port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI(
          'mixed-port',
          Number(e.target.value),
          refetch,
        ),
    },
    {
      label: () => t('port', { name: 'HTTP' }),
      key: 'port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI('port', Number(e.target.value), refetch),
    },
    {
      label: () => t('port', { name: 'Socks' }),
      key: 'socks-port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI(
          'socks-port',
          Number(e.target.value),
          refetch,
        ),
    },
    {
      label: () => t('port', { name: 'Redir' }),
      key: 'redir-port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI(
          'redir-port',
          Number(e.target.value),
          refetch,
        ),
    },
    {
      label: () => t('port', { name: 'TProxy' }),
      key: 'tproxy-port',
      onChange: (e: Event & { target: HTMLInputElement }) =>
        void updateBackendConfigAPI(
          'tproxy-port',
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

  const modes = () => {
    return configsData()?.modes || ['rule', 'direct', 'global']
  }

  return (
    <div class="flex flex-col gap-4">
      <select
        class="select select-bordered"
        value={configsData()?.mode}
        onChange={(e) =>
          void updateBackendConfigAPI('mode', e.target.value, refetch)
        }
      >
        <For each={modes()}>
          {(name) => (
            <option value={name}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t(name as any) ?? name}
            </option>
          )}
        </For>
      </select>

      <Show when={!isSingBox()}>
        <form class="grid grid-cols-3 gap-2 sm:grid-cols-5" use:form={form}>
          <For each={portList}>
            {(item) => (
              <div class="form-control">
                <label for={item.key} class="label">
                  <span class="label-text">{item.label()}</span>
                </label>

                <input
                  id={item.key}
                  name={item.key}
                  type="number"
                  class="input input-bordered"
                  placeholder={item.label()}
                  onChange={item.onChange}
                />
              </div>
            )}
          </For>
        </form>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div class="form-control">
            <label for="enable-allow-lan" class="label gap-2">
              <span class="label-text">{t('allowLan')}</span>
            </label>

            <input
              id="enable-allow-lan"
              type="checkbox"
              class="toggle"
              checked={configsData()?.['allow-lan']}
              onChange={(e) =>
                void updateBackendConfigAPI(
                  'allow-lan',
                  e.target.checked,
                  refetch,
                )
              }
            />
          </div>

          <div class="form-control">
            <label for="enable-tun-device" class="label gap-2">
              <span class="label-text">{t('enableTunDevice')}</span>
            </label>

            <input
              id="enable-tun-device"
              type="checkbox"
              class="toggle"
              checked={configsData()?.tun?.enable}
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
              value={configsData()?.tun?.stack}
              onChange={(e) =>
                void updateBackendConfigAPI(
                  'tun',
                  { stack: e.target.value },
                  refetch,
                )
              }
            >
              <option>Mixed</option>
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
              value={configsData()?.tun?.device}
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
      </Show>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button
          class="btn-primary"
          loading={reloadingConfigFile()}
          onClick={reloadConfigFileAPI}
        >
          {t('reloadConfig')}
        </Button>

        <Button
          class="btn-accent"
          loading={flushingFakeIPData()}
          onClick={flushFakeIPDataAPI}
        >
          {t('flushFakeIP')}
        </Button>

        <Button
          class="btn-warning"
          loading={restartingBackend()}
          onClick={restartBackendAPI}
        >
          {t('restartCore')}
        </Button>

        <Show when={!isSingBox()}>
          <Button
            class="btn-secondary"
            loading={updatingGEODatabases()}
            onClick={updateGEODatabasesAPI}
          >
            {t('updateGEODatabases')}
          </Button>

          <Button
            class="btn-info"
            loading={upgradingUI()}
            onClick={upgradeUIAPI}
          >
            {t('upgradeUI')}
          </Button>

          <Button
            class="btn-error"
            loading={upgradingBackend()}
            onClick={upgradeBackendAPI}
          >
            {t('upgradeCore')}
          </Button>
        </Show>
      </div>
    </div>
  )
}

const ConfigForXd = () => {
  const [t] = useI18n()
  const navigate = useNavigate()
  const languages = [
    {
      label: () => t('en'),
      value: LANG.EN,
    },
    {
      label: () => t('zh'),
      value: LANG.ZH,
    },
  ]

  return (
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col items-center">
          <ConfigTitle>{t('useTwemoji')}</ConfigTitle>

          <input
            type="checkbox"
            class="toggle"
            checked={useTwemoji()}
            onChange={(e) => setUseTwemoji(e.target.checked)}
          />
        </div>

        <div class="flex flex-col">
          <ConfigTitle>{t('switchLanguage')}</ConfigTitle>

          <select
            class="select select-bordered"
            onChange={(e) => setLocale(e.target.value as LANG)}
          >
            <For each={languages}>
              {(lang) => (
                <option selected={locale() === lang.value} value={lang.value}>
                  {lang.label()}
                </option>
              )}
            </For>
          </select>
        </div>

        <div class="flex flex-col">
          <div class="py-2 text-center text-lg font-semibold">&nbsp;</div>
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
                value={favDayTheme()}
                onChange={(e) =>
                  setFavDayTheme(e.target.value as (typeof themes)[number])
                }
              >
                <For each={themes}>
                  {(theme) => <option value={theme}>{theme}</option>}
                </For>
              </select>
            </div>

            <div class="flex flex-col">
              <ConfigTitle>{t('favNightTheme')}</ConfigTitle>

              <select
                class="select select-bordered"
                value={favNightTheme()}
                onChange={(e) =>
                  setFavNightTheme(e.target.value as (typeof themes)[number])
                }
              >
                <For each={themes}>
                  {(theme) => <option value={theme}>{theme}</option>}
                </For>
              </select>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

const Versions: Component<{ backendVersion: Accessor<string> }> = ({
  backendVersion,
}) => {
  const [isUpdateAvailable, setIsUpdateAvailable] = createSignal(false)

  createEffect(async () => {
    const version = backendVersion()

    if (!version) return

    setIsUpdateAvailable(await isUpdateAvailableAPI(version))
  })

  return (
    <div class="grid grid-cols-2 gap-4">
      <kbd class="kbd">{import.meta.env.APP_VERSION}</kbd>

      <div class="relative">
        <Show when={isUpdateAvailable()}>
          <span class="absolute -right-1 -top-1 flex h-3 w-3">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
            <span class="inline-flex h-3 w-3 rounded-full bg-info" />
          </span>
        </Show>

        <kbd class="kbd w-full">{backendVersion()}</kbd>
      </div>
    </div>
  )
}

export default () => {
  const navigate = useNavigate()

  if (!endpoint()) {
    navigate('/setup', { replace: true })

    return null
  }

  const [t] = useI18n()

  updateBackendVersion()

  return (
    <div class="mx-auto flex max-w-screen-md flex-col gap-4">
      <Show when={!isSingBox()}>
        <ConfigTitle withDivider>{t('dnsQuery')}</ConfigTitle>

        <DNSQueryForm />
      </Show>

      <ConfigTitle withDivider>{t('coreConfig')}</ConfigTitle>

      <ConfigForm />

      <ConfigTitle withDivider>{t('xdConfig')}</ConfigTitle>

      <ConfigForXd />

      <ConfigTitle withDivider>{t('version')}</ConfigTitle>

      <Versions backendVersion={backendVersion} />
    </div>
  )
}
