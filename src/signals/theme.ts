import { makePersisted } from '@solid-primitives/storage'
import { themes } from '~/constants'

export const [curTheme, setCurTheme] = makePersisted(
  createSignal<(typeof themes)[number]>('sunset'),
  { name: 'theme', storage: localStorage },
)
