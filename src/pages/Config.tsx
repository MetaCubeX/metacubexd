import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import type { Accessor, JSX, ParentComponent } from 'solid-js'
import { toast } from 'solid-toast'
import { twMerge } from 'tailwind-merge'
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
} from '~/apis'
import { Button, ConfigTitle, DocumentTitle, Versions } from '~/components'
import { LANG, ROUTES, themes } from '~/constants'
import { Dict, locale, setLocale, useI18n } from '~/i18n'
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
import type { DNSQuery } from '~/types'

const Toggle: ParentComponent<JSX.InputHTMLAttributes<HTMLInputElement>> = (
  props,
) => {
  const [local, others] = splitProps(props, ['class'])

  return (
    <input type="checkbox" class={twMerge('toggle', local.class)} {...others} />
  )
}

const Input: ParentComponent<JSX.InputHTMLAttributes<HTMLInputElement>> = (
  props,
) => {
  const [local, others] = splitProps(props, ['class'])

  return <input class={twMerge('input min-w-0', local.class)} {...others} />
}

const Select: ParentComponent<JSX.SelectHTMLAttributes<HTMLSelectElement>> = (
  props,
) => {
  const [local, others] = splitProps(props, ['class'])

  return (
    <select class={twMerge('select', local.class)} {...others}>
      {children(() => others.children)()}
    </select>
  )
}

const Label: ParentComponent<JSX.LabelHTMLAttributes<HTMLLabelElement>> = (
  props,
) => {
  const [local, others] = splitProps(props, ['class'])

  return (
    <label class={twMerge('label truncate', local.class)} {...others}>
      {children(() => others.children)()}
    </label>
  )
}

const dnsQueryFormSchema = z.object({
  name: z.string(),
  type: z.string(),
})

const DNSQueryForm = () => {
  const [t] = useI18n()
  const request = useRequest()
  const defaultDNSQueryTarget = 'google.com'

  const { form, isSubmitting } = createForm<z.infer<typeof dnsQueryFormSchema>>(
    {
      extend: validator({ schema: dnsQueryFormSchema }),
      onSubmit: (values) =>
        request
          .get('dns/query', {
            searchParams: {
              name: values.name || defaultDNSQueryTarget,
              type: values.type,
            },
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
        <Input
          type="search"
          name="name"
          class="flex-1"
          placeholder={defaultDNSQueryTarget}
          onInput={(e) => {
            if (!e.target.value) setDNSQueryResult([])
          }}
        />

        <div class="flex items-center gap-2">
          <Select name="type">
            <option>A</option>
            <option>AAAA</option>
            <option>MX</option>
          </Select>

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

const ConfigForm: ParentComponent<{
  isSingBox: Accessor<boolean>
}> = ({ isSingBox }) => {
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

  const modes = createMemo(() => {
    const cfg = configsData()

    return cfg?.['mode-list'] || cfg?.modes || ['rule', 'direct', 'global']
  })

  return (
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-3 gap-2">
        <fieldset class="fieldset">
          <Label for="enable-allow-lan">{t('allowLan')}</Label>

          <Toggle
            id="enable-allow-lan"
            checked={configsData()?.['allow-lan']}
            onChange={(e) =>
              void updateBackendConfigAPI(
                'allow-lan',
                e.target.checked,
                refetch,
              )
            }
          />
        </fieldset>

        <fieldset class="fieldset">
          <Label for="mode">{t('runningMode')}</Label>

          <Select
            id="mode"
            onChange={(e) =>
              void updateBackendConfigAPI('mode', e.target.value, refetch)
            }
          >
            <For each={modes()}>
              {(name) => (
                <option selected={name === configsData()?.mode} value={name}>
                  {t(name as keyof Dict) ?? name}
                </option>
              )}
            </For>
          </Select>
        </fieldset>

        <fieldset class="fieldset">
          <Label for="interface-name">{t('outboundInterfaceName')}</Label>

          <Input
            id="interface-name"
            value={configsData()?.['interface-name']}
            onChange={(e) =>
              void updateBackendConfigAPI(
                'interface-name',
                e.target.value,
                refetch,
              )
            }
          />
        </fieldset>
      </div>

      <Show when={!isSingBox()}>
        <div class="grid grid-cols-3 gap-2">
          <fieldset class="fieldset">
            <Label for="enable-tun-device">{t('enableTunDevice')}</Label>

            <Toggle
              id="enable-tun-device"
              checked={configsData()?.tun?.enable}
              onChange={(e) =>
                void updateBackendConfigAPI(
                  'tun',
                  { enable: e.target.checked },
                  refetch,
                )
              }
            />
          </fieldset>

          <fieldset class="fieldset">
            <Label for="tun-ip-stack">{t('tunModeStack')}</Label>

            <Select
              id="tun-ip-stack"
              onChange={(e) =>
                void updateBackendConfigAPI(
                  'tun',
                  { stack: e.target.value },
                  refetch,
                )
              }
            >
              <For each={['Mixed', 'gVisor', 'System', 'LWIP']}>
                {(name) => (
                  <option
                    selected={configsData()?.tun?.stack === name}
                    value={name}
                  >
                    {name}
                  </option>
                )}
              </For>
            </Select>
          </fieldset>

          <fieldset class="fieldset">
            <Label for="device-name">{t('tunDeviceName')}</Label>

            <Input
              id="device-name"
              value={configsData()?.tun?.device}
              onChange={(e) =>
                void updateBackendConfigAPI(
                  'tun',
                  { device: e.target.value },
                  refetch,
                )
              }
            />
          </fieldset>
        </div>

        <form class="grid grid-cols-3 gap-2 sm:grid-cols-5" use:form={form}>
          <For each={portList}>
            {(item) => (
              <fieldset class="fieldset">
                <Label for={item.key}>{item.label()}</Label>

                <Input
                  id={item.key}
                  name={item.key}
                  type="number"
                  placeholder={item.label()}
                  onChange={item.onChange}
                />
              </fieldset>
            )}
          </For>
        </form>
      </Show>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-2">
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
    {
      label: () => t('ru'),
      value: LANG.RU,
    },
  ]

  return (
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col items-center">
          <ConfigTitle>{t('useTwemoji')}</ConfigTitle>

          <Toggle
            checked={useTwemoji()}
            onChange={(e) => setUseTwemoji(e.target.checked)}
          />
        </div>

        <div class="flex flex-col">
          <ConfigTitle>{t('switchLanguage')}</ConfigTitle>

          <Select onChange={(e) => setLocale(e.target.value as LANG)}>
            <For each={languages}>
              {(lang) => (
                <option selected={locale() === lang.value} value={lang.value}>
                  {lang.label()}
                </option>
              )}
            </For>
          </Select>
        </div>

        <div class="flex flex-col">
          <ConfigTitle>{endpoint()?.url}</ConfigTitle>

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

          <Toggle
            checked={autoSwitchTheme()}
            onChange={(e) => setAutoSwitchTheme(e.target.checked)}
          />
        </div>

        <Show when={autoSwitchTheme()}>
          <div class="flex flex-col gap-2">
            <div class="flex flex-col">
              <ConfigTitle>{t('favDayTheme')}</ConfigTitle>

              <Select
                onChange={(e) =>
                  setFavDayTheme(e.target.value as (typeof themes)[number])
                }
              >
                <For each={themes}>
                  {(theme) => (
                    <option selected={favDayTheme() === theme} value={theme}>
                      {theme}
                    </option>
                  )}
                </For>
              </Select>
            </div>

            <div class="flex flex-col">
              <ConfigTitle>{t('favNightTheme')}</ConfigTitle>

              <Select
                onChange={(e) =>
                  setFavNightTheme(e.target.value as (typeof themes)[number])
                }
              >
                <For each={themes}>
                  {(theme) => (
                    <option selected={favNightTheme() === theme} value={theme}>
                      {theme}
                    </option>
                  )}
                </For>
              </Select>
            </div>
          </div>
        </Show>
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

  const frontendVersion = `v${import.meta.env.APP_VERSION}`
  const [backendVersion] = createResource(fetchBackendVersionAPI, {
    initialValue: '',
  })

  const isSingBox = createMemo(
    () => backendVersion()?.includes('sing-box') || false,
  )

  return (
    <>
      <DocumentTitle>{t('config')}</DocumentTitle>

      <div class="mx-auto flex max-w-screen-md flex-col gap-4">
        <Show when={!isSingBox()}>
          <ConfigTitle withDivider>{t('dnsQuery')}</ConfigTitle>

          <DNSQueryForm />
        </Show>

        <ConfigTitle withDivider>{t('coreConfig')}</ConfigTitle>

        <ConfigForm isSingBox={isSingBox} />

        <ConfigTitle withDivider>{t('xdConfig')}</ConfigTitle>

        <ConfigForXd />

        <ConfigTitle withDivider>{t('version')}</ConfigTitle>

        <Show when={!backendVersion.loading}>
          <Versions
            frontendVersion={frontendVersion}
            backendVersion={backendVersion}
          />
        </Show>
      </div>
    </>
  )
}
