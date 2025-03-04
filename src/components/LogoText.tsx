import { endpoint } from '~/signals'

export const LogoText = () => (
  <div class="text-md flex items-center gap-1 font-bold whitespace-nowrap uppercase sm:text-xl">
    <A
      class="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent"
      href={endpoint() ? '/' : '/setup'}
    >
      metacube
    </A>
    <span>(</span>
    <a
      class="text-primary transition-transform hover:scale-125 hover:rotate-90"
      href="https://github.com/metacubex/metacubexd"
      target="_blank"
    >
      xd
    </a>
    <span>)</span>
  </div>
)
