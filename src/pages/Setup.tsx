import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { useI18n } from '@solid-primitives/i18n'
import { useNavigate } from '@solidjs/router'
import { IconX } from '@tabler/icons-solidjs'
import ky from 'ky'
import { For, onMount } from 'solid-js'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import { Button } from '~/components'
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

  const onSubmit = async ({ url, secret }: { url: string; secret: string }) => {
    const list = endpointList().slice()
    const point = list.find((history) => history.url === url)

    if (point) {
      const { id, secret: oldSecret } = point

      if (secret !== oldSecret && !(await checkEndpoint(url, secret))) {
        point.secret = secret
        setEndpointList(list)
      }

      onSetupSuccess(id)
      return
    }

    if (!(await checkEndpoint(url, secret))) {
      return
    }

    const id = uuid()
    setEndpointList([{ id, url, secret }, ...list])
    onSetupSuccess(id)
  }

  const { form } = createForm<z.infer<typeof schema>>({
    extend: validator({ schema }),
    onSubmit: onSubmit,
  })

  const onRemove = (id: string) =>
    setEndpointList(endpointList().filter((e) => e.id !== id))

  onMount(() => {
    const query = new URLSearchParams(window.location.search)

    if (query.has('hostname')) {
      onSubmit({
        url: `http://${query.get('hostname')}${
          query.get('port') && ':' + query.get('port')
        }`,
        secret: query.get('secret') ?? '',
      })
    } else {
      onSubmit({
        url: 'http://127.0.0.1:9090',
        secret: '',
      })
    }
  })
  return (
    <div class="mx-auto flex flex-col items-center gap-4 py-10 sm:w-2/3">
      <form class="contents" use:form={form}>
        <div class="flex w-full flex-col gap-4">
          <input
            name="url"
            type="url"
            class="input input-bordered"
            placeholder="host url"
            list="defaultEndpoints"
          />

          <datalist id="defaultEndpoints">
            <option value="http://127.0.0.1:9090" />
          </datalist>

          <input
            name="secret"
            type="password"
            class="input input-bordered"
            placeholder="secret"
          />

          <Button type="submit" class="btn-primary join-item uppercase">
            {t('add')}
          </Button>
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

              <Button
                class="btn-circle btn-ghost btn-xs text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(id)
                }}
              >
                <IconX />
              </Button>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
