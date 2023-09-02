import { useI18n } from '@solid-primitives/i18n'
import { A, useLocation, useNavigate } from '@solidjs/router'
import {
  IconArrowsExchange,
  IconFileStack,
  IconGlobe,
  IconGlobeFilled,
  IconHome,
  IconLanguage,
  IconMenu,
  IconNetwork,
  IconPalette,
  IconRuler,
  IconSettings,
} from '@tabler/icons-solidjs'
import {
  For,
  ParentComponent,
  Show,
  createMemo,
  createSignal,
  onMount,
} from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { LANG, ROUTE } from '~/config/enum'
import { themes } from '~/constants'
import { setCurTheme, setSelectedEndpoint } from '~/signals'
import { useProxies } from '~/signals/proxies'

const Nav: ParentComponent<{ href: string; tooltip: string }> = ({
  href,
  tooltip,
  children,
}) => (
  <li class="tooltip tooltip-bottom" data-tip={tooltip}>
    <A class="rounded-box" href={href}>
      {children}
    </A>
  </li>
)

const ThemeSwitcher = () => (
  <div class="drawer drawer-end w-auto sm:ml-auto">
    <input id="themes" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex items-center">
      <label
        for="themes"
        class="btn btn-circle btn-primary drawer-button btn-sm"
      >
        <IconPalette />
      </label>
    </div>

    <div class="drawer-side">
      <label for="themes" class="drawer-overlay" />

      <ul class="menu rounded-box gap-2 bg-base-300 p-2 shadow">
        <For each={themes}>
          {(theme) => (
            <li
              data-theme={theme}
              class="btn btn-xs"
              onClick={() => setCurTheme(theme)}
            >
              {theme}
            </li>
          )}
        </For>
      </ul>
    </div>
  </div>
)

export const Header = () => {
  const [t, { locale }] = useI18n()
  const { updateProxy, proxyProviders } = useProxies()

  onMount(() => {
    updateProxy()
  })

  const navs = createMemo(() => {
    const list = [
      {
        href: ROUTE.Overview,
        name: t('overview'),
        icon: <IconHome />,
      },
      {
        href: ROUTE.Proxies,
        name: t('proxies'),
        icon: <IconGlobe />,
      },
      {
        href: ROUTE.Rules,
        name: t('rules'),
        icon: <IconRuler />,
      },
      {
        href: ROUTE.Conns,
        name: t('connections'),
        icon: <IconNetwork />,
      },
      {
        href: ROUTE.Log,
        name: t('logs'),
        icon: <IconFileStack />,
      },
      {
        href: ROUTE.Config,
        name: t('config'),
        icon: <IconSettings />,
      },
    ]

    if (proxyProviders().length > 0) {
      list.splice(2, 0, {
        href: ROUTE.Proxyprovider,
        name: t('proxyProviders'),
        icon: <IconGlobeFilled />,
      })
    }

    return list
  })

  const location = useLocation()
  const navigate = useNavigate()

  const [openedDrawer, setOpenedDrawer] = createSignal(false)

  const onSwitchEndpointClick = () => {
    setSelectedEndpoint('')
    navigate('/setup')
  }

  return (
    <ul class="navbar rounded-box sticky inset-x-0 top-2 z-10 mx-2 mt-2 flex w-auto items-center justify-center bg-base-300 px-4">
      <div class="navbar-start gap-4">
        <div class={twMerge('drawer w-auto lg:hidden', '')}>
          <input
            id="navs"
            type="checkbox"
            class="drawer-toggle"
            onChange={(e) => setOpenedDrawer(e.target.checked)}
            checked={openedDrawer()}
          />

          <div class="drawer-content flex items-center">
            <label for="navs" class="btn btn-circle drawer-button btn-sm">
              <IconMenu />
            </label>
          </div>

          <div class="drawer-side">
            <label for="navs" class="drawer-overlay" />

            <ul class="menu rounded-box min-h-full w-2/5 gap-2 bg-base-300 pt-20 shadow">
              <For each={navs()}>
                {({ href, name }) => (
                  <li onClick={() => setOpenedDrawer(false)}>
                    <A href={href}>{name}</A>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </div>

        <a
          class="text-xl font-bold normal-case"
          href="https://github.com/metacubex/metacubexd"
          target="_blank"
        >
          metacubexd
        </a>
      </div>

      <Show when={location.pathname !== '/setup'}>
        <div class="navbar-center hidden lg:flex">
          <ul class="menu menu-horizontal gap-2">
            <For each={navs()}>
              {({ href, name, icon }) => (
                <Nav href={href} tooltip={name}>
                  {icon}
                </Nav>
              )}
            </For>
          </ul>
        </div>
      </Show>

      <div class="navbar-end">
        <div class="flex items-center gap-2">
          <button
            class="btn btn-circle btn-sm"
            onClick={() => {
              const curLocale = locale()

              locale(curLocale === LANG.EN ? LANG.ZH : LANG.EN)
            }}
          >
            <IconLanguage />
          </button>

          <ThemeSwitcher />

          <button
            class="btn btn-circle btn-secondary btn-sm"
            onClick={onSwitchEndpointClick}
          >
            <IconArrowsExchange />
          </button>
        </div>
      </div>
    </ul>
  )
}
