import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { useI18n } from '@solid-primitives/i18n'
import { For, Show, createSignal, onMount } from 'solid-js'
import { z } from 'zod'
import { PROXIES_PREVIEW_TYPE } from '~/config/enum'
import { themes } from '~/constants'
import { useRequest } from '~/signals'
import {
  applyThemeByMode,
  autoCloseConns,
  autoSwitchTheme,
  favDayTheme,
  favNightTheme,
  proxiesPreviewType,
  renderInTwoColumn,
  setAutoCloseConns,
  setAutoSwitchTheme,
  setFavDayTheme,
  setFavNightTheme,
  setProxiesPreviewType,
  setRenderInTwoColumn,
  setUrlForDelayTest,
  urlForDelayTest,
} from '~/signals/config'
import type { DNSQuery, Config as IConfig } from '~/types'

const dnsQueryFormSchema = z.object({
  name: z.string(),
  type: z.string(),
})

const DNSQueryForm = () => {
  const [t] = useI18n()
  const request = useRequest()

  const { form } = createForm<z.infer<typeof dnsQueryFormSchema>>({
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
  })

  const [DNSQueryResult, setDNSQueryResult] = createSignal<string[]>([])

  return (
    <div class="flex flex-col">
      <form use:form={form} class="flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          class="input input-bordered w-full max-w-xs sm:flex-1"
        />
        <div class="flex items-center gap-2">
          <select name="type" class="select select-bordered">
            <option>A</option>
            <option>AAAA</option>
            <option>MX</option>
          </select>
          <button type="submit" class="btn btn-primary">
            {t('dnsQuery')}
          </button>
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

  return (
    <div>
      <form class="contents" use:form={form}>
        <For each={portsList}>
          {(item) => (
            <div class="form-control w-64 max-w-xs">
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
    </div>
  )
}

const ConfigForXd = () => {
  const [t] = useI18n()

  return (
    <div class="grid gap-4">
      <div class="flex flex-col">
        <div class="pb-4">{t('renderInTwoColumns')}</div>
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
        <div class="pb-4">{t('autoSwitchTheme')}</div>
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
          <div class="pb-4">{t('favDayTheme')}</div>
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
          <div class="pb-4">{t('favNightTheme')}</div>
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
        <div class="pb-4">{t('proxiesPreviewType')}</div>
        <div class="flex items-center gap-4">
          <For each={Object.values(PROXIES_PREVIEW_TYPE)}>
            {(value) => (
              <label class="flex items-center gap-2">
                <span>{t(value)}</span>

                <input
                  class="radio"
                  aria-label={value}
                  type="radio"
                  checked={value === proxiesPreviewType()}
                  onChange={() => setProxiesPreviewType(value)}
                />
              </label>
            )}
          </For>
        </div>
      </div>

      <div>
        <div class="pb-4">{t('autoCloseConns')}</div>

        <input
          class="toggle"
          type="checkbox"
          checked={autoCloseConns()}
          onChange={(e) => setAutoCloseConns(e.target.checked)}
        />
      </div>

      <div class="flex flex-col">
        <div class="pb-4">{t('urlForDelayTest')}</div>

        <input
          class="w-100 input input-bordered max-w-md"
          value={urlForDelayTest()}
          onChange={(e) => setUrlForDelayTest(e.target?.value!)}
        />
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
    </div>
  )
}
