import { makePersisted } from '@solid-primitives/storage'
import { createSignal } from 'solid-js'
import { PROXIES_PREVIEW_TYPE } from '~/config/enum'

export const [proxiesPreviewType, setProxiesPreviewType] = makePersisted(
  createSignal(PROXIES_PREVIEW_TYPE.BAR),
  { name: 'proxiesPreviewType', storage: localStorage },
)
export const [urlForDelayTest, setUrlForDelayTest] = makePersisted(
  createSignal('https://www.gstatic.com/generate_204'),
  { name: 'urlForDelayTest', storage: localStorage },
)
export const [autoCloseConns, setAutoCloseConns] = makePersisted(
  createSignal(false),
  { name: 'autoCloseConns', storage: localStorage },
)
