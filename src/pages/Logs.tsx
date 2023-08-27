import { createEventSignal } from '@solid-primitives/event-listener'
import { createReconnectingWS } from '@solid-primitives/websocket'
import { For, createEffect, createSignal } from 'solid-js'
import { secret, wsEndpointURL } from '~/signals'

export const Logs = () => {
  const [search, setSearch] = createSignal('')
  const [logs, setLogs] = createSignal<string[]>([])

  const ws = createReconnectingWS(`${wsEndpointURL()}/logs?token=${secret()}`)

  const messageEvent = createEventSignal<{
    message: WebSocketEventMap['message']
  }>(ws, 'message')

  createEffect(() => {
    const data = messageEvent()?.data

    if (!data) {
      return
    }

    setLogs((logs) =>
      [
        ...logs,
        (JSON.parse(data) as { type: string; payload: string }).payload,
      ].slice(-100),
    )
  })

  return (
    <div class="flex flex-col gap-4">
      <input
        class="input input-primary"
        placeholder="Search"
        onInput={(e) => setSearch(e.target.value)}
      />

      <div class="overflow-x-auto whitespace-nowrap">
        <For
          each={
            search()
              ? logs().filter((log) =>
                  log.toLowerCase().includes(search().toLowerCase()),
                )
              : logs()
          }
        >
          {(log) => (
            <div class="flex gap-4">
              <div class="flex-shrink-0">{log}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
