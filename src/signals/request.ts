import { createEventSignal } from '@solid-primitives/event-listener'
import { makePersisted } from '@solid-primitives/storage'
import { createReconnectingWS } from '@solid-primitives/websocket'
import ky from 'ky'
import { createMemo, createSignal } from 'solid-js'
import { LogType } from '~/types'

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

type MaybeQuery = {
	level?: LogType
};

export const useWsRequestWithQuerys = <T>(path: string, querys?: MaybeQuery) => {

	let querys_append = ""
	
	if (querys && Object.keys(querys).length > 0) {
		const keys = Object.keys(querys) as (keyof  MaybeQuery)[];
		keys.forEach(k => {
			querys_append += `&${k}=${querys[k]}`
		})
	}

	const ws = createReconnectingWS(
	  `${wsEndpointURL()}/${path}?token=${secret()}${querys_append}`,
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
  