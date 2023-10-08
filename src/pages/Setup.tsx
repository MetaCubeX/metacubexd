import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { useLocation, useNavigate } from '@solidjs/router'
import { IconX } from '@tabler/icons-solidjs'
import ky from 'ky'
import { For, onMount } from 'solid-js'
import { toast } from 'solid-toast'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import { Button } from '~/components'
import { transformEndpointURL } from '~/helpers'
import { useI18n } from '~/i18n'
import {
  endpointList,
  selectedEndpoint,
  setEndpointList,
  setSelectedEndpoint,
} from '~/signals'

const schema = z.object({
  url: z.string().min(1),
  secret: z.string(),
})

export default () => {
  const [t] = useI18n()
  const location = useLocation()
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
      .catch((err) => {
        const { message } = err as Error

        toast.error(message)
      })

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
    const transformedURL = transformEndpointURL(url)

    if (!(await checkEndpoint(transformedURL, secret))) {
      return
    }

    const id = uuid()
    const list = endpointList().slice()
    const point = list.find((history) => history.url === transformedURL)

    if (!point) {
      // new host and secret
      setEndpointList([{ id, url: transformedURL, secret }, ...list])
      onSetupSuccess(id)

      return
    }

    // exist host we update secret and id no matter if secret is equal or not
    point.secret = secret
    point.id = id

    setEndpointList(list)
    onSetupSuccess(id)
  }

  const onError = (err: unknown) => {
    const { message } = err as Error

    toast.error(message)
  }

  const { form } = createForm<z.infer<typeof schema>>({
    extend: validator({ schema }),
    onSubmit,
    onError,
  })

  const onRemove = (id: string) => {
    if (selectedEndpoint() === id) {
      setSelectedEndpoint('')
    }

    setEndpointList(endpointList().filter((e) => e.id !== id))
  }

  onMount(() => {
    const query = new URLSearchParams(location.search)

    if (query.has('hostname')) {
      void onSubmit({
        url: `${window.location.protocol}//${query.get('hostname')}${
          query.get('port') ? `:${query.get('port')}` : ''
        }`,
        secret: query.get('secret') ?? '',
      })
    } else if (endpointList().length === 0) {
      /**
        we only try auto login when there is nothing in endpoint list
        or user who is using default config won't be able to switch to another endpoint ever
      */
      void onSubmit({
        url: 'http://127.0.0.1:9090',
        secret: '',
      })
    }
  })

  return (
    <div class="mx-auto flex max-w-screen-sm flex-col items-center gap-4 py-10">
      <form class="contents" use:form={form}>
        <div class="flex w-full flex-col gap-4">
          <div class="flex-1">
            <label class="label">
              <span class="label-text">{t('endpointURL')}</span>
            </label>

            <input
              name="url"
              type="url"
              class="input input-bordered w-full"
              placeholder="http://127.0.0.1:9090"
              list="defaultEndpoints"
            />

            <datalist id="defaultEndpoints">
              <option value="http://127.0.0.1:9090" />
            </datalist>
          </div>

          <div class="flex-1">
            <label class="label">
              <span class="label-text">{t('secret')}</span>
            </label>

            <input
              name="secret"
              type="password"
              class="input input-bordered w-full"
              placeholder="secret"
            />
          </div>

          <Button type="submit" class="btn-primary uppercase">
            {t('add')}
          </Button>
        </div>
      </form>

      <div class="grid w-full grid-cols-2 gap-4">
        <For each={endpointList()}>
          {({ id, url }) => (
            <div
              class="badge badge-info flex w-full cursor-pointer items-center justify-between gap-4 py-4"
              onClick={() => onEndpointSelect(id)}
            >
              <span class="truncate">{url}</span>

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
