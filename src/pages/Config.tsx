import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { For, Show, createSignal, onMount } from 'solid-js'
import { z } from 'zod'
import { useRequest } from '~/signals'
import type { DNSQuery, Config as IConfig } from '~/types'

const schema = z.object({
  port: z.number(),
  'socks-port': z.number(),
  'redir-port': z.number(),
  'tproxy-port': z.number(),
  'mixed-port': z.number(),
})

import { makePersisted } from '@solid-primitives/storage'
import { PROXIES_PREVIEW_TYPE } from '~/config/enum'

export const [proxiesPreviewType, setProxiesPreviewType] = makePersisted(
  createSignal(PROXIES_PREVIEW_TYPE.BAR),
  {
    name: 'proxiesPreviewType',
    storage: localStorage,
  },
)

export default () => {
  const request = useRequest()

  const [DNSQueryName, setDNSQueryName] = createSignal('')
  const [DNSQueryResult, setDNSQueryResult] = createSignal<string[]>([])

  const onDNSQuery = () =>
    request
      .get('dns/query', {
        searchParams: {
          name: DNSQueryName(),
        },
      })
      .json<DNSQuery>()
      .then(({ Answer }) => {
        setDNSQueryResult(Answer.map(({ data }) => data))
      })

  const portsList = [
    {
      label: 'Http Port',
      key: 'port',
    },
    {
      label: 'Socks Port',
      key: 'socks-port',
    },
    {
      label: 'Redir Port',
      key: 'redir-port',
    },
    {
      label: 'Tproxy Port',
      key: 'tproxy-port',
    },
    {
      label: 'Mixed Port',
      key: 'mixed-port',
    },
  ]

  const { form, setInitialValues, reset } = createForm<z.infer<typeof schema>>({
    extend: validator({ schema }),
  })

  onMount(async () => {
    const configs = await request.get('configs').json<IConfig>()

    setInitialValues(configs)
    reset()
  })

  return (
    <div>
      <form
        class="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          onDNSQuery()
        }}
      >
        <input
          class="input input-bordered flex-1"
          value={DNSQueryName()}
          onSubmit={onDNSQuery}
          onInput={(e) => setDNSQueryName(e.target.value)}
        />

        <button type="submit" class="btn btn-primary">
          DNS Query
        </button>
      </form>

      <Show when={DNSQueryResult().length > 0}>
        <div class="flex flex-col p-4">
          <For each={DNSQueryResult()}>
            {(item) => <div class="py-2">{item}</div>}
          </For>
        </div>
      </Show>

      <div class="mt-4">
        <div>Proxies preview type:</div>
        <div class="join">
          <label class="flex items-center">
            Bar
            <input
              class="radio m-4"
              aria-label="Bar"
              type="radio"
              name="proxiesPreviewType"
              checked={PROXIES_PREVIEW_TYPE.BAR === proxiesPreviewType()}
              onChange={() => setProxiesPreviewType(PROXIES_PREVIEW_TYPE.BAR)}
            />
          </label>
          <label class="flex items-center">
            Dots
            <input
              class="radio m-4"
              aria-label="Dots"
              type="radio"
              name="proxiesPreviewType"
              checked={PROXIES_PREVIEW_TYPE.DOTS === proxiesPreviewType()}
              onChange={() => setProxiesPreviewType(PROXIES_PREVIEW_TYPE.DOTS)}
            />
          </label>
        </div>
      </div>

      <form class="contents" use:form={form}>
        <For each={portsList}>
          {(item) => (
            <div class="form-control w-64 max-w-xs">
              <label class="label">
                <span class="label-text">{item.label}</span>
              </label>
              <input
                name={item.key}
                type="number"
                class="input input-bordered"
                placeholder={item.label}
              />
            </div>
          )}
        </For>
      </form>
    </div>
  )
}
