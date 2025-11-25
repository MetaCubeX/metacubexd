import Tooltip from '@corvu/tooltip'
import { type Accessor, type Component, ParentComponent, Show } from 'solid-js'
import {
  upgradeBackendAPI,
  upgradeUIAPI,
  upgradingBackend,
  upgradingUI,
} from '~/apis'
import { Changelog } from '~/components'
import { useBackendRelease, useFrontendRelease } from '~/query/hooks'

const UpgradeButton: ParentComponent<{
  isUpdateAvailable?: boolean
  isUpdating: Accessor<boolean>
  onUpdate: () => Promise<unknown>
}> = (props) => {
  const [local, others] = splitProps(props, ['isUpdateAvailable', 'children'])
  const { isUpdating, onUpdate } = others

  return (
    <div
      class="flex w-full items-center justify-center gap-2"
      onClick={() => {
        if (isUpdating()) return

        onUpdate()
      }}
    >
      {local.children}

      <Show when={isUpdating()}>
        <span class="loading loading-sm loading-infinity" />
      </Show>
    </div>
  )
}

const UpdateAvailableIndicator = () => (
  <span class="absolute -top-1 -right-1 inline-grid *:[grid-area:1/1]">
    <span class="status animate-ping status-info" />
    <div class="status status-info" />
  </span>
)

export const Versions: Component<{
  frontendVersion: string
  backendVersion: Accessor<string>
}> = ({ frontendVersion, backendVersion }) => {
  const frontendRelease = useFrontendRelease(frontendVersion)
  const backendRelease = useBackendRelease(backendVersion)

  return (
    <div class="mx-2 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mx-0">
      <Tooltip
        placement="top"
        floatingOptions={{
          offset: 10,
        }}
      >
        <Tooltip.Anchor as="kbd" class="relative kbd w-full py-4">
          <Show when={frontendRelease.data?.isUpdateAvailable}>
            <UpdateAvailableIndicator />
          </Show>

          <Tooltip.Trigger class="w-full cursor-pointer">
            <UpgradeButton
              isUpdateAvailable={frontendRelease.data?.isUpdateAvailable}
              isUpdating={upgradingUI}
              onUpdate={async () => {
                await upgradeUIAPI()
                window.location.reload()
              }}
            >
              {import.meta.env.APP_VERSION}
            </UpgradeButton>
          </Tooltip.Trigger>

          <Show when={frontendRelease.data?.changelog}>
            <Tooltip.Content class="z-50">
              <Tooltip.Arrow class="text-neutral" />

              <Changelog body={frontendRelease.data!.changelog!} />
            </Tooltip.Content>
          </Show>
        </Tooltip.Anchor>
      </Tooltip>

      <Tooltip
        placement="top"
        floatingOptions={{
          offset: 10,
        }}
      >
        <Tooltip.Anchor as="kbd" class="relative kbd w-full py-4">
          <Show when={backendRelease.data?.isUpdateAvailable}>
            <UpdateAvailableIndicator />
          </Show>

          <Tooltip.Trigger class="w-full cursor-pointer">
            <UpgradeButton
              isUpdateAvailable={backendRelease.data?.isUpdateAvailable}
              isUpdating={upgradingBackend}
              onUpdate={async () => {
                await upgradeBackendAPI()
                window.location.reload()
              }}
            >
              {backendVersion()}
            </UpgradeButton>
          </Tooltip.Trigger>

          <Show when={backendRelease.data?.changelog}>
            <Tooltip.Content class="z-50">
              <Tooltip.Arrow class="text-neutral" />

              <Changelog body={backendRelease.data!.changelog!} />
            </Tooltip.Content>
          </Show>
        </Tooltip.Anchor>
      </Tooltip>
    </div>
  )
}
