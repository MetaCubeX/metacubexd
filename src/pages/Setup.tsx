import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { useI18n } from '@solid-primitives/i18n'
import { useNavigate } from '@solidjs/router'
import { IconX } from '@tabler/icons-solidjs'
import ky from 'ky'
import { For } from 'solid-js'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import { endpointList, setEndpointList, setSelectedEndpoint } from '~/signals'

const schema = z.object({
  url: z.string().url().nonempty(),
  secret: z.string(),
})

export default () => {
  const [t] = useI18n()
  const navigate = useNavigate()

  const onSetupSuccess = (id: string) => {
    setSelectedEndpoint(id)
    navigate('/overview')
  }

  const checkEndpoint = (url: string, secret: string) =>
    ky
      .get(url, {
        headers: secret
          ? {
              Authorization: `Bearer ${secret}`,
            }
          : {},
      })
      .then(({ ok }) => ok)
      .catch(() => false)

  const onEndpointSelect = async (id: string) => {
    const endpoint = endpointList().find((e) => e.id === id)

    if (!endpoint) {
      return
    }

    if (!(await checkEndpoint(endpoint.url, endpoint.secret))) {
      return
    }

    onSetupSuccess(id)
  }

  const { form } = createForm<z.infer<typeof schema>>({
    extend: validator({ schema }),
    async onSubmit({ url, secret }) {
      const i = endpointList().findIndex((history) => history.url === url)

      if (i > -1) {
        const { id, secret: oldSecret } = endpointList()[i]

        if (secret !== oldSecret && !(await checkEndpoint(url, secret))) {
          endpointList()[i].secret = secret
          setEndpointList(endpointList())
        }

        onSetupSuccess(id)
        return
      }

      if (!(await checkEndpoint(url, secret))) {
        return
      }

      const id = uuid()
      setEndpointList([{ id, url, secret }, ...endpointList()])
      onSetupSuccess(id)
    },
  })

  const onRemove = (id: string) =>
    setEndpointList(endpointList().filter((e) => e.id !== id))

  return (
    <div class="mx-auto flex flex-col items-center gap-4 py-10 sm:w-2/3">
      <form class="contents" use:form={form}>
        <div class="flex w-full flex-col gap-4">
          <input
            name="url"
            type="url"
            class="input input-bordered"
            placeholder="http://127.0.0.1:9090"
            list="defaultEndpoints"
          />

          <datalist id="defaultEndpoints">
            <option value="http://127.0.0.1:9090" />
          </datalist>

          <input
            name="secret"
            type="password"
            autocomplete="new-password"
            class="input input-bordered"
            placeholder="secret"
          />

          <button type="submit" class="btn btn-primary join-item uppercase">
            {t('add')}
          </button>
        </div>
      </form>

      <div class="flex w-full flex-col gap-4">
        <For each={endpointList()}>
          {({ id, url }) => (
            <div
              class="badge badge-info flex w-full cursor-pointer items-center gap-4 py-4"
              onClick={() => onEndpointSelect(id)}
            >
              {url}

              <button
                class="btn btn-circle btn-ghost btn-xs text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(id)
                }}
              >
                <IconX />
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
