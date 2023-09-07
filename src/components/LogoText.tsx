import { Show } from 'solid-js'
import { curTheme } from '~/signals'

export const LogoText = () => (
  <a
    class="text-md flex items-center gap-1 whitespace-nowrap font-bold sm:text-xl"
    href="https://github.com/metacubex/metacubexd"
    target="_blank"
  >
    <Show
      when={curTheme() === 'halloween'}
      fallback={
        <span class="bg-gradient-to-br from-primary to-secondary bg-clip-text uppercase text-transparent">
          metacube
        </span>
      }
    >
      <>
        <span class="px-[0.1em] capitalize text-white">meta</span>
        <span class="rounded-[0.1em] bg-[#f7971d] px-[0.1em] text-black">
          cube
        </span>
      </>
    </Show>
    <span class="px-[0.1em]">(</span>
    <div class="uppercase text-primary transition-transform hover:rotate-90 hover:scale-125">
      xd
    </div>
    <span>)</span>
  </a>
)
