import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { useI18n } from '@solid-primitives/i18n'
import { useNavigate } from '@solidjs/router'
import { For, Show, createSignal, onMount } from 'solid-js'
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
import { Button, ConfigTitle } from '~/components'
import { LANG, MODE_OPTIONS, ROUTES, themes } from '~/constants'
import {
  autoSwitchTheme,
  backendConfig,
  favDayTheme,
  favNightTheme,
  setAutoSwitchTheme,
  setBackendConfig,
  setFavDayTheme,
  setFavNightTheme,
  setSelectedEndpoint,
  setTwemoji,
  useRequest,
  useTwemoji,
} from '~/signals'
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
      label: 'HTTP Port',
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
      label: 'TProxy Port',
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
          class="select select-bordered w-full max-w-xs"
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
    </Show>
  )

  const checkboxList = [
    {
      label: t('autoSwitchTheme'),
      value: autoSwitchTheme,
      onChange: (value: boolean) => {
        setAutoSwitchTheme(value)
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
