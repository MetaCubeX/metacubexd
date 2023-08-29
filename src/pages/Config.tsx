import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { For, onMount } from 'solid-js'
import { z } from 'zod'
import { useRequest } from '~/signals'
import type { Config as IConfig } from '~/types'

const schema = z.object({
  port: z.number(),
  'socks-port': z.number(),
  'redir-port': z.number(),
  'tproxy-port': z.number(),
  'mixed-port': z.number(),
})

export default () => {
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
