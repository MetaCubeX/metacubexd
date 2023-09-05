import { useI18n } from '@solid-primitives/i18n'
import { A, useLocation } from '@solidjs/router'
import {
  IconFileStack,
  IconGlobe,
  IconGlobeFilled,
  IconHome,
  IconMenu,
  IconNetwork,
  IconPalette,
  IconRuler,
  IconSettings,
} from '@tabler/icons-solidjs'
import { For, ParentComponent, Show, createMemo, createSignal } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { ROUTES, themes } from '~/constants'
import { renderProxiesInSamePage, setCurTheme, useProxies } from '~/signals'

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

      <ul class="menu rounded-l-box gap-2 bg-base-300 p-2 shadow">
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

const LogoText = () => (
  <a
    class="flex gap-2 whitespace-nowrap text-xl font-bold uppercase"
    href="https://github.com/metacubex/metacubexd"
    target="_blank"
  >
    <span>metacube, </span>
    <div class="transition-transform hover:rotate-90 hover:scale-125">xd</div>
  </a>
)

export const Header = () => {
  const [t] = useI18n()
  const { proxyProviders } = useProxies()
  const navs = createMemo(() => {
    const list = [
      {
        href: ROUTES.Overview,
        name: t('overview'),
        icon: <IconHome />,
      },
      {
        href: ROUTES.Proxies,
        name: t('proxies'),
        icon: <IconGlobe />,
      },
      {
        href: ROUTES.Rules,
        name: t('rules'),
        icon: <IconRuler />,
      },
      {
        href: ROUTES.Conns,
        name: t('connections'),
        icon: <IconNetwork />,
      },
      {
        href: ROUTES.Log,
        name: t('logs'),
        icon: <IconFileStack />,
      },
      {
        href: ROUTES.Config,
        name: t('config'),
        icon: <IconSettings />,
      },
    ]

    if (proxyProviders().length > 0 && !renderProxiesInSamePage()) {
      list.splice(2, 0, {
        href: ROUTES.ProxyProvider,
        name: t('proxyProviders'),
        icon: <IconGlobeFilled />,
      })
    }

    return list
  })

  const location = useLocation()

  const [openedDrawer, setOpenedDrawer] = createSignal(false)

  return (
    <ul class="navbar rounded-box sticky inset-x-0 top-2 z-50 mx-2 mt-2 flex w-auto items-center justify-center bg-base-300 px-4">
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

            <ul class="menu rounded-r-box min-h-full w-2/5 gap-2 bg-base-300 pt-20 shadow">
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

        <LogoText />
      </div>

      <Show when={location.pathname !== ROUTES.Setup}>
        <div class="navbar-center hidden lg:flex">
          <ul class="menu menu-horizontal menu-lg gap-2">
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
          <ThemeSwitcher />
        </div>
      </div>
    </ul>
  )
}
