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
      <form class="form" use:form={form}>
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
