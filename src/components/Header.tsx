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
import type { ParentComponent } from 'solid-js'
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
    <A class="rounded-box" activeClass="menu-active" href={href}>
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
        class="drawer-button btn btn-circle btn-sm btn-primary"
      >
        <IconPalette />
      </label>
    </div>

    <div class="drawer-side overflow-x-hidden">
      <label for="themes" class="drawer-overlay" />

      <ul class="menu gap-2 rounded-l-box bg-base-300 p-2">
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
    <ul class="z-50 navbar flex w-auto items-center justify-center bg-base-300 px-4 shadow-lg">
      <div class="navbar-start gap-4">
        <div class="drawer w-auto lg:hidden">
          <input
            id="navs"
            type="checkbox"
            class="drawer-toggle"
            onChange={(e) => setOpenedDrawer(e.target.checked)}
            checked={openedDrawer()}
          />

          <div class="drawer-content flex w-6 items-center">
            <label for="navs" class="drawer-button btn btn-circle btn-sm">
              <IconMenu />
            </label>
          </div>

          <div class="drawer-side">
            <label for="navs" class="drawer-overlay" />

            <ul class="menu min-h-full min-w-2/5 gap-2 rounded-r-box bg-base-300 pt-20">
              <For each={navs()}>
                {({ href, name, icon }) => (
                  <li onClick={() => setOpenedDrawer(false)}>
                    <A href={href} activeClass="menu-active">
                      {icon} {name}
                    </A>
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
          <ul class="menu menu-horizontal gap-2 menu-lg p-0">
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
