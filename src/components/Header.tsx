import {
  IconFileStack,
  IconGlobe,
  IconHome,
  IconNetwork,
  IconPalette,
  IconRuler,
  IconSettings,
} from '@tabler/icons-solidjs'
import type { JSX, ParentComponent } from 'solid-js'
import { LogoText } from '~/components'
import { ROUTES, themes } from '~/constants'
import { useI18n } from '~/i18n'
import { setCurTheme } from '~/signals'

interface NavItem {
  href: string
  name: string
  icon: JSX.Element
}

const useNavItems = () => {
  const [t] = useI18n()

  return [
    { href: ROUTES.Overview, name: t('overview'), icon: <IconHome /> },
    { href: ROUTES.Proxies, name: t('proxies'), icon: <IconGlobe /> },
    { href: ROUTES.Rules, name: t('rules'), icon: <IconRuler /> },
    { href: ROUTES.Conns, name: t('connections'), icon: <IconNetwork /> },
    { href: ROUTES.Log, name: t('logs'), icon: <IconFileStack /> },
    { href: ROUTES.Config, name: t('config'), icon: <IconSettings /> },
  ] as NavItem[]
}

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

const MobileBottomNav = () => {
  const navs = useNavItems()
  const location = useLocation()

  createEffect(() => {
    const shouldShow = location.pathname !== ROUTES.Setup
    document.body.style.paddingBottom =
      shouldShow && window.innerWidth < 1024 ? '4rem' : '0'
  })

  onCleanup(() => {
    document.body.style.paddingBottom = '0'
  })

  return (
    <Show when={location.pathname !== ROUTES.Setup}>
      <nav class="fixed inset-x-0 bottom-0 z-50 border-t border-base-content/10 bg-base-300/95 backdrop-blur-sm lg:hidden">
        <div class="grid h-16 grid-cols-6">
          <For each={navs}>
            {({ href, name, icon }) => {
              const isActive = () => location.pathname === href

              return (
                <A
                  href={href}
                  class="relative flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:bg-base-200/50"
                >
                  <Show when={isActive()}>
                    <div class="absolute top-0 left-1/2 h-1 w-8 -translate-x-1/2 transform rounded-b-full bg-primary" />
                  </Show>
                  <div
                    class="text-xl transition-all duration-200"
                    classList={{
                      'text-primary scale-110': isActive(),
                      'text-base-content/70': !isActive(),
                    }}
                  >
                    {icon}
                  </div>
                  <Show when={isActive()}>
                    <span class="animate-in fade-in slide-in-from-bottom-1 text-xs font-medium text-primary duration-200">
                      {name}
                    </span>
                  </Show>
                </A>
              )
            }}
          </For>
        </div>
      </nav>
    </Show>
  )
}

export const Header = () => {
  const navs = useNavItems()
  const location = useLocation()

  return (
    <>
      <header class="navbar z-50 flex w-auto items-center justify-center bg-base-300 px-4 shadow-lg">
        <div class="navbar-start">
          <LogoText />
        </div>

        <Show when={location.pathname !== ROUTES.Setup}>
          <nav class="navbar-center hidden lg:flex">
            <ul class="menu menu-horizontal gap-2 menu-lg p-0">
              <For each={navs}>
                {({ href, name, icon }) => (
                  <Nav href={href} tooltip={name}>
                    {icon}
                  </Nav>
                )}
              </For>
            </ul>
          </nav>
        </Show>

        <div class="navbar-end">
          <ThemeSwitcher />
        </div>
      </header>
      <MobileBottomNav />
    </>
  )
}
