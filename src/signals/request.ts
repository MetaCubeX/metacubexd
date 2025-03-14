import { createEventSignal } from '@solid-primitives/event-listener'
import { makePersisted } from '@solid-primitives/storage'
import {
  createReconnectingWS,
  ReconnectingWebSocket,
} from '@solid-primitives/websocket'
import ky from 'ky'
import _ from 'lodash'

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

export const useGithubAPI = () => {
  const headers = new Headers()

  if (import.meta.env.VITE_APP_GH_TOKEN) {
    headers.set('Authorization', `Bearer ${import.meta.env.VITE_APP_GH_TOKEN}`)
  }

  return ky.create({
    prefixUrl: 'https://api.github.com',
    headers,
  })
}

export const endpoint = () =>
  endpointList().find(({ id }) => id === selectedEndpoint())

export const secret = () => endpoint()?.secret

export const wsEndpointURL = () =>
  _.trimEnd(new URL(endpoint()?.url ?? '').href.replace('http', 'ws'), '/')

const webSocketInstanceMap = new Map<string, ReconnectingWebSocket>()

export const useWsRequest = <T>(
  path: string,
  queries: Record<string, string> = {},
) => {
  const oldInstance = webSocketInstanceMap.get(path)

  if (oldInstance) {
    oldInstance.close()
    webSocketInstanceMap.delete(path)
  }

  const queryParams = new URLSearchParams(queries)
  queryParams.set('token', secret() ?? '')

  const ws = createReconnectingWS(
    `${wsEndpointURL()}/${path}?${queryParams.toString()}`,
  )

  const event = createEventSignal<{
    message: MessageEvent
  }>(ws, 'message')

  webSocketInstanceMap.set(path, ws)

  return createMemo<T | null>(() => {
    const e = event()

    if (!e) {
      return null
    }

    return JSON.parse(event()?.data)
  })
}
