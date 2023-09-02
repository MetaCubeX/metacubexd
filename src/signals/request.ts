import { makePersisted } from '@solid-primitives/storage'
import ky from 'ky'
import { createSignal } from 'solid-js'

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

export const useRequest = () => {
  const e = endpoint()

  return ky.create({
    prefixUrl: e?.url,
    headers: {
      Authorization: e?.secret ? `Bearer ${e.secret}` : '',
    },
  })
}

export const endpoint = () =>
  endpointList().find(({ id }) => id === selectedEndpoint())

export const secret = () => endpoint()?.secret

export const wsEndpointURL = () => endpoint()?.url.replace('http', 'ws')
