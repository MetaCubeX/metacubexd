import { makePersisted } from '@solid-primitives/storage'
import ky from 'ky'
import { createSignal } from 'solid-js'
import { themes } from '~/constants'

export const [selectedEndpoint, setSelectedEndpoint] = makePersisted(
  createSignal(''),
  {
    name: 'selectedEndpoint',
    storage: localStorage,
  },
)

export const [endpointList, setEndpointList] = makePersisted(
  createSignal<
    {
      id: string
      url: string
      secret: string
    }[]
  >([]),
  { name: 'endpointList', storage: localStorage },
)

export const [curTheme, setCurTheme] = makePersisted(
  createSignal<(typeof themes)[number]>('business'),
  { name: 'theme', storage: localStorage },
)

export const endpoint = () =>
  endpointList().find(({ id }) => id === selectedEndpoint())

export const secret = () => endpoint()?.secret

export const wsEndpointURL = () => endpoint()?.url.replace('http', 'ws')

export const useRequest = () => {
  const e = endpoint()

  return ky.create({
    prefixUrl: e?.url,
    headers: {
      Authorization: e?.secret ? `Bearer ${e.secret}` : '',
    },
  })
}
