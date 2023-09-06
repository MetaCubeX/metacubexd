import { createEventSignal } from '@solid-primitives/event-listener'
import { makePersisted } from '@solid-primitives/storage'
import { createReconnectingWS } from '@solid-primitives/websocket'
import ky from 'ky'
import { createMemo, createSignal } from 'solid-js'

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
    headers: { Authorization: e?.secret ? `Bearer ${e.secret}` : '' },
  })
}

export const endpoint = () =>
  endpointList().find(({ id }) => id === selectedEndpoint())

export const secret = () => endpoint()?.secret

export const wsEndpointURL = () =>
  new URL(endpoint()?.url ?? '').origin.replace('http', 'ws')

export const useWsRequest = <T>(path: string) => {
  const ws = createReconnectingWS(
    `${wsEndpointURL()}/${path}?token=${secret()}`,
  )

  const event = createEventSignal<{
    message: MessageEvent
  }>(ws, 'message')

  return createMemo<T | null>(() => {
    const e = event()

    if (!e) {
      return null
    }

    return JSON.parse(event()?.data)
  })
}
