import { makePersisted } from '@solid-primitives/storage'
import { themes } from '~/constants'

export const curThemeDefault: (typeof themes)[number] = 'sunset'

export const [curTheme, setCurTheme] = makePersisted(
  createSignal<(typeof themes)[number]>(curThemeDefault),
  { name: 'theme', storage: localStorage },
)
