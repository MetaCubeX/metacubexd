import { A, useLocation } from '@solidjs/router'
import {
  IconFileStack,
  IconGlobe,
  IconHome,
  IconMenu,
  IconNetwork,
  IconPalette,
  IconRuler,
  IconSettings,
} from '@tabler/icons-solidjs'
import { For, ParentComponent, Show, createSignal } from 'solid-js'
import { LogoText } from '~/components'
import { ROUTES, themes } from '~/constants'
import { useI18n } from '~/i18n'
import { setCurTheme } from '~/signals'

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

      <ul class="menu rounded-l-box gap-2 bg-base-300 p-2">
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
  const [t] = useI18n()
  const navs = () => [
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

  const location = useLocation()

  const [openedDrawer, setOpenedDrawer] = createSignal(false)

  return (
    <ul class="navbar sticky inset-x-0 top-0 z-50 flex w-auto items-center justify-center bg-base-300 px-4 shadow-lg">
      <div class="navbar-start gap-4">
        <div class="drawer w-auto lg:hidden">
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

            <ul class="menu rounded-r-box min-h-full w-2/5 gap-2 bg-base-300 pt-20">
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
          <ul class="menu menu-horizontal menu-lg gap-2 p-0">
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
