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

  if (!e) {
    return ky.create({})
  }

  const headers = new Headers()

  if (e.secret) {
    headers.set('Authorization', `Bearer ${e.secret}`)
  }

  return ky.create({
    prefixUrl: e.url,
    headers,
  })
}

export const endpoint = () =>
  endpointList().find(({ id }) => id === selectedEndpoint())

export const secret = () => endpoint()?.secret

export const wsEndpointURL = () =>
  new URL(endpoint()?.url ?? '').origin.replace('http', 'ws')

export const useWsRequest = <T>(
  path: string,
  queries: Record<string, string> = {},
) => {
  const queryParams = new URLSearchParams(queries)
  queryParams.set('token', secret() ?? '')

  const ws = createReconnectingWS(
    `${wsEndpointURL()}/${path}?${queryParams.toString()}`,
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
