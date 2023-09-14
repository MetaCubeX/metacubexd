import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { useI18n } from '@solid-primitives/i18n'
import { useNavigate } from '@solidjs/router'
import {
  For,
  ParentComponent,
  Show,
  children,
  createSignal,
  onMount,
} from 'solid-js'
import { z } from 'zod'
import {
  fetchBackendConfigAPI,
  fetchBackendVersionAPI,
  restartBackendAPI,
  restartingBackend,
  updateBackendConfigAPI,
  updateGEODatabasesAPI,
  updatingGEODatabases,
  upgradeBackendAPI,
  upgradingBackend,
} from '~/apis'
import { Button } from '~/components'
import {
  LANG,
  LOG_LEVEL,
  MODE_OPTIONS,
  PROXIES_ORDERING_TYPE,
  PROXIES_PREVIEW_TYPE,
  ROUTES,
  TAILWINDCSS_SIZE,
  themes,
} from '~/constants'
import {
  applyThemeByMode,
  autoCloseConns,
  autoSwitchTheme,
  backendConfig,
  favDayTheme,
  favNightTheme,
  latencyTestTimeoutDuration,
  logLevel,
  proxiesOrderingType,
  proxiesPreviewType,
  renderInTwoColumns,
  setAutoCloseConns,
  setAutoSwitchTheme,
  setBackendConfig,
  setFavDayTheme,
  setFavNightTheme,
  setLatencyTestTimeoutDuration,
  setLogLevel,
  setProxiesOrderingType,
  setProxiesPreviewType,
  setRenderInTwoColumns,
  setSelectedEndpoint,
  setTableSize,
  setTwemoji,
  setUrlForLatencyTest,
  tableSize,
  urlForLatencyTest,
  useRequest,
  useTwemoji,
} from '~/signals'
import type { DNSQuery } from '~/types'

const dnsQueryFormSchema = z.object({
  name: z.string(),
  type: z.string(),
})

const ConfigTitle: ParentComponent = (props) => (
  <div class="pb-4 text-lg font-semibold">
    {children(() => props.children)()}
  </div>
)

const DNSQueryForm = () => {
  const [t] = useI18n()
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
      <form use:form={form} class="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          name="name"
          class="input input-bordered w-full sm:flex-1"
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

  const portsList = [
    {
      label: 'Http Port',
      key: 'port',
    },
    {
      label: 'Socks Port',
      key: 'socks-port',
    },
    {
      label: 'Redir Port',
      key: 'redir-port',
    },
    {
      label: 'Tproxy Port',
      key: 'tproxy-port',
    },
    {
      label: 'Mixed Port',
      key: 'mixed-port',
    },
  ]

  const { form, setInitialValues, reset } = createForm<
    z.infer<typeof configFormSchema>
  >({ extend: validator({ schema: configFormSchema }) })

  onMount(async () => {
    const configs = await fetchBackendConfigAPI()
    setBackendConfig(configs)
    setInitialValues(configs)
    reset()
  })

  return (
    <div class="flex flex-col gap-4">
      <select
        class="select select-bordered"
        value={backendConfig()?.mode}
        onChange={(e) => updateBackendConfigAPI('mode', e.target.value)}
      >
        <option value={MODE_OPTIONS.Global}>{t('global')}</option>
        <option value={MODE_OPTIONS.Rule}>{t('rule')}</option>
        <option value={MODE_OPTIONS.Direct}>{t('direct')}</option>
      </select>

      <form class="contents" use:form={form}>
        <For each={portsList}>
          {(item) => (
            <div class="form-control w-64 max-w-sm">
              <label class="label">
                <span class="label-text">{item.label}</span>
              </label>

              <input
                name={item.key}
                type="number"
                class="input input-bordered"
                placeholder={item.label}
              />
            </div>
          )}
        </For>
      </form>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          loading={updatingGEODatabases()}
          onClick={updateGEODatabasesAPI}
        >
          {t('updateGEODatabases')}
        </Button>

        <Button loading={upgradingBackend()} onClick={upgradeBackendAPI}>
          {t('upgradeCore')}
        </Button>

        <Button loading={restartingBackend()} onClick={restartBackendAPI}>
          {t('restartCore')}
        </Button>
      </div>

      <div class="flex flex-col">
        <ConfigTitle>{t('urlForLatencyTest')}</ConfigTitle>

        <input
          class="input input-bordered max-w-md"
          value={urlForLatencyTest()}
          onChange={(e) => setUrlForLatencyTest(e.target.value)}
        />
      </div>

      <div>
        <ConfigTitle>
          {t('latencyTestTimeoutDuration')} ({t('ms')})
        </ConfigTitle>

        <input
          type="number"
          class="input input-bordered w-full max-w-md"
          value={latencyTestTimeoutDuration()}
          onChange={(e) =>
            setLatencyTestTimeoutDuration(Number(e.target.value))
          }
        />
      </div>

      <div>
        <ConfigTitle>{t('autoCloseConns')}</ConfigTitle>

        <input
          class="toggle"
          type="checkbox"
          checked={autoCloseConns()}
          onChange={(e) => setAutoCloseConns(e.target.checked)}
        />
      </div>
    </div>
  )
}

const ConfigForXd = () => {
  const [t, { locale }] = useI18n()
  const navigate = useNavigate()

  const onSwitchEndpointClick = () => {
    setSelectedEndpoint('')
    navigate(ROUTES.Setup)
  }

  const autoSwitchThemeSubChild = () => (
    <Show when={autoSwitchTheme()}>
      <div class="flex flex-col">
        <ConfigTitle>{t('favDayTheme')}</ConfigTitle>

        <select
          class="select select-bordered w-full max-w-xs"
          onChange={(e) => {
            setFavDayTheme(e.target.value)
            applyThemeByMode()
          }}
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
          class="select select-bordered w-full max-w-xs"
          onChange={(e) => {
            setFavNightTheme(e.target.value)
            applyThemeByMode()
          }}
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
    </Show>
  )

  const checkboxList = [
    {
      label: t('renderInTwoColumns'),
      value: renderInTwoColumns,
      onChange: setRenderInTwoColumns,
    },
    {
      label: t('autoSwitchTheme'),
      value: autoSwitchTheme,
      onChange: (value: boolean) => {
        setAutoSwitchTheme(value)
        applyThemeByMode()
      },
      subChild: autoSwitchThemeSubChild,
    },
    {
      label: t('useTwemoji'),
      value: useTwemoji,
      onChange: setTwemoji,
    },
  ]

  return (
    <div class="grid gap-4">
      <For each={checkboxList}>
        {(checkbox) => (
          <>
            <div class="flex flex-col">
              <ConfigTitle>{checkbox.label}</ConfigTitle>

              <input
                type="checkbox"
                class="toggle"
                checked={checkbox.value()}
                onChange={(e) => {
                  checkbox.onChange(e.target.checked)
                }}
              />
            </div>
            {checkbox.subChild?.()}
          </>
        )}
      </For>

      <div>
        <ConfigTitle>{t('proxiesPreviewType')}</ConfigTitle>

        <select
          class="select select-bordered w-full max-w-xs"
          value={proxiesPreviewType()}
          onChange={(e) =>
            setProxiesPreviewType(e.target.value as PROXIES_PREVIEW_TYPE)
          }
        >
          <For each={Object.values(PROXIES_PREVIEW_TYPE)}>
            {(value) => <option value={value}>{t(value)}</option>}
          </For>
        </select>
      </div>

      <div>
        <ConfigTitle>{t('proxiesSorting')}</ConfigTitle>

        <select
          class="select select-bordered w-full max-w-xs"
          value={proxiesOrderingType()}
          onChange={(e) =>
            setProxiesOrderingType(e.target.value as PROXIES_ORDERING_TYPE)
          }
        >
          <For each={Object.values(PROXIES_ORDERING_TYPE)}>
            {(value) => (
              <option class="flex items-center gap-2" value={value}>
                {t(value)}
              </option>
            )}
          </For>
        </select>
      </div>

      <div>
        <ConfigTitle>{t('tableSize')}</ConfigTitle>

        <select
          class="select select-bordered w-full max-w-xs"
          value={tableSize()}
          onChange={(e) => setTableSize(e.target.value as TAILWINDCSS_SIZE)}
        >
          <For each={Object.values(TAILWINDCSS_SIZE)}>
            {(value) => <option value={value}>{t(value)}</option>}
          </For>
        </select>
      </div>

      <div>
        <ConfigTitle>{t('logLevel')}</ConfigTitle>

        <select
          class="select select-bordered w-full max-w-xs"
          onChange={(e) => {
            setLogLevel(e.target.value as LOG_LEVEL)
          }}
        >
          <For
            each={[
              LOG_LEVEL.Info,
              LOG_LEVEL.Error,
              LOG_LEVEL.Warning,
              LOG_LEVEL.Debug,
              LOG_LEVEL.Silent,
            ]}
          >
            {(level) => (
              <option selected={logLevel() === level} value={level}>
                {t(level)}
              </option>
            )}
          </For>
        </select>
      </div>

      <div>
        <Button
          onClick={() => {
            const curLocale = locale()

            locale(curLocale === LANG.EN ? LANG.ZH : LANG.EN)
          }}
        >
          {t('switchLanguage')}
        </Button>
      </div>

      <div>
        <Button onClick={onSwitchEndpointClick}>{t('switchEndpoint')}</Button>
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
    <div class="flex gap-4">
      <kbd class="kbd">{import.meta.env.version}</kbd>
      <kbd class="kbd">{backendVersion()}</kbd>
    </div>
  )
}

export default () => {
  return (
    <div class="flex flex-col gap-4">
      <DNSQueryForm />
      <ConfigForm />
      <ConfigForXd />

      <Versions />
    </div>
  )
}
