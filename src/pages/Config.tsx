import { useRequest } from '~/signals'
import { For, onMount } from 'solid-js'
import type { Config as IConfig } from '~/types'
import { z } from 'zod'
import { validator } from '@felte/validator-zod'
import { createForm } from '@felte/solid'

const schema = z.object({
  port: z.number(),
  'socks-port': z.number(),
  'redir-port': z.number(),
  'tproxy-port': z.number(),
  'mixed-port': z.number(),
})

export const Config = () => {
  const request = useRequest()
  const formItemList = [
    {
      key: 'port',
      label: 'port',
      type: 'number',
    },
    {
      key: 'socks-port',
      label: 'socks-port',
      type: 'number',
    },
    {
      key: 'redir-port',
      label: 'redir-port',
      type: 'number',
    },
    {
      key: 'tproxy-port',
      label: 'tproxy-port',
      type: 'number',
    },
    {
      key: 'mixed-port',
      label: 'mixed-port',
      type: 'number',
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
      config
      <form class="contents" use:form={form}>
        <For each={formItemList}>
          {(item) => (
            <div class="flex flex-row items-center gap-4">
              {item.label}:
              <input
                name={item.key}
                type={item.type}
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
