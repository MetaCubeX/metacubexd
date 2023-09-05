import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { useI18n } from '@solid-primitives/i18n'
import { useNavigate } from '@solidjs/router'
import { For, Show, createSignal, onMount } from 'solid-js'
import { z } from 'zod'
import { Button } from '~/components'
import {
  LANG,
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
  favDayTheme,
  favNightTheme,
  proxiesOrderingType,
  proxiesPreviewType,
  renderInTwoColumn,
  renderProxiesInSamePage,
  setAutoCloseConns,
  setAutoSwitchTheme,
  setFavDayTheme,
  setFavNightTheme,
  setProxiesOrderingType,
  setProxiesPreviewType,
  setRenderInTwoColumn,
  setRenderProxiesInSamePage,
  setSelectedEndpoint,
  setTableSize,
  setTwemoji,
  setUrlForLatencyTest,
  tableSize,
  urlForLatencyTest,
  useRequest,
  useTwemoji,
} from '~/signals'
import type { DNSQuery, Config as IConfig } from '~/types'

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
        <input name="name" class="input input-bordered w-full sm:flex-1" />
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
  const request = useRequest()

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
    const configs = await request.get('configs').json<IConfig>()

    setInitialValues(configs)
    reset()
  })

  const [updatingGEODatabases, setUpdatingGEODatabases] = createSignal(false)
  const [upgrading, setUpgrading] = createSignal(false)
  const [restarting, setRestarting] = createSignal(false)

  const onUpdateGEODatabases = async () => {
    setUpdatingGEODatabases(true)
    try {
      await request.post('configs/geo')
    } catch {}
    setUpdatingGEODatabases(false)
  }

  const onUpgrade = async () => {
    setUpgrading(true)
    try {
      await request.post('upgrade')
    } catch {}
    setUpgrading(false)
  }

  const onRestart = async () => {
    setRestarting(true)
    try {
      await request.post('restart')
    } catch {}
    setRestarting(false)
  }

  return (
    <div class="flex flex-col gap-4">
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
        <Button loading={updatingGEODatabases()} onClick={onUpdateGEODatabases}>
          {t('updateGEODatabases')}
        </Button>

        <Button loading={upgrading()} onClick={onUpgrade}>
          {t('upgradeCore')}
        </Button>

        <Button loading={restarting()} onClick={onRestart}>
          {t('restartCore')}
        </Button>
      </div>

      <div class="flex flex-col">
        <div class="pb-4 text-lg font-semibold">{t('urlForLatencyTest')}</div>

        <input
          class="w-100 input input-bordered max-w-md"
          value={urlForLatencyTest()}
          onChange={(e) => setUrlForLatencyTest(e.target.value)}
        />
      </div>

      <div>
        <div class="pb-4 text-lg font-semibold">{t('autoCloseConns')}</div>

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

  return (
    <div class="grid gap-4">
      <div class="flex flex-col">
        <div class="pb-4 text-lg font-semibold">{t('renderInTwoColumns')}</div>
        <input
          type="checkbox"
          class="toggle"
          checked={renderInTwoColumn()}
          onChange={(e) => {
            setRenderInTwoColumn(e.target.checked)
          }}
        />
      </div>
      <div class="flex flex-col">
        <div class="pb-4 text-lg font-semibold">
          {t('renderProxiesInSamePage')}
        </div>
        <input
          type="checkbox"
          class="toggle"
          checked={renderProxiesInSamePage()}
          onChange={(e) => {
            setRenderProxiesInSamePage(e.target.checked)
          }}
        />
      </div>
      <div class="flex flex-col">
        <div class="pb-4 text-lg font-semibold">{t('autoSwitchTheme')}</div>
        <input
          type="checkbox"
          class="toggle"
          checked={autoSwitchTheme()}
          onChange={(e) => {
            setAutoSwitchTheme(e.target.checked)
            applyThemeByMode()
          }}
        />
      </div>
      <Show when={autoSwitchTheme()}>
        <div class="flex flex-col">
          <div class="pb-4 text-lg font-semibold">{t('favDayTheme')}</div>
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
          <div class="pb-4 text-lg font-semibold">{t('favNightTheme')}</div>

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

      <div>
        <div class="pb-4 text-lg font-semibold">{t('useTwemoji')}</div>

        <input
          class="toggle"
          type="checkbox"
          checked={useTwemoji()}
          onChange={(e) => setTwemoji(e.target.checked)}
        />
      </div>

      <div>
        <div class="pb-4 text-lg font-semibold">{t('proxiesPreviewType')}</div>

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
        <div class="pb-4 text-lg font-semibold">{t('proxiesSorting')}</div>

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
        <div class="pb-4 text-lg font-semibold">{t('tableSize')}</div>

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

export default () => {
  return (
    <div class="flex flex-col gap-4">
      <DNSQueryForm />
      <ConfigForm />
      <ConfigForXd />

      <kbd class="kbd">{import.meta.env.version}</kbd>
    </div>
  )
}
