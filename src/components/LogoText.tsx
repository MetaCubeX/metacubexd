import { A } from '@solidjs/router'
import { endpoint } from '~/signals'
import { EndPointLabel } from './EndpointLabel'

export const LogoText = () => (
  <div class="text-md group flex items-center gap-1 whitespace-nowrap font-bold uppercase sm:text-xl">
    <A
      class="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent"
      href={endpoint() ? '/' : '/setup'}
    >
      metacube
    </A>
    <span>(</span>
    <a
      class="text-primary transition-transform hover:rotate-90 hover:scale-125"
      href="https://github.com/metacubex/metacubexd"
      target="_blank"
    >
      xd
    </a>
    <span>)</span>

    <EndPointLabel class="ml-2 w-0 transition-all group-hover:w-full" />
  </div>
)
