import Tooltip from '@corvu/tooltip'
import {
  type Accessor,
  type Component,
  createResource,
  ParentComponent,
  Show,
} from 'solid-js'
import {
  backendReleaseAPI,
  frontendReleaseAPI,
  upgradeBackendAPI,
  upgradeUIAPI,
  upgradingBackend,
  upgradingUI,
} from '~/apis'
import { Changelog } from '~/components'

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
  const [frontendRelease] = createResource(() =>
    frontendReleaseAPI(frontendVersion),
  )
  const [backendRelease] = createResource(backendVersion, () =>
    backendReleaseAPI(backendVersion()),
  )

  return (
    <div class="mx-2 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mx-0">
      <Tooltip
        placement="top"
        floatingOptions={{
          offset: 10,
        }}
      >
        <Tooltip.Anchor as="kbd" class="relative kbd w-full py-4">
          <Show when={frontendRelease()?.isUpdateAvailable}>
            <UpdateAvailableIndicator />
          </Show>

          <Tooltip.Trigger class="w-full cursor-pointer">
            <UpgradeButton
              isUpdateAvailable={frontendRelease()?.isUpdateAvailable}
              isUpdating={upgradingUI}
              onUpdate={async () => {
                await upgradeUIAPI()
                window.location.reload()
              }}
            >
              {import.meta.env.APP_VERSION}
            </UpgradeButton>
          </Tooltip.Trigger>

          <Show when={frontendRelease()?.changelog}>
            <Tooltip.Content class="z-50">
              <Tooltip.Arrow class="text-neutral" />

              <Changelog body={frontendRelease()!.changelog!} />
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
          <Show when={backendRelease()?.isUpdateAvailable}>
            <UpdateAvailableIndicator />
          </Show>

          <Tooltip.Trigger class="w-full cursor-pointer">
            <UpgradeButton
              isUpdateAvailable={backendRelease()?.isUpdateAvailable}
              isUpdating={upgradingBackend}
              onUpdate={async () => {
                await upgradeBackendAPI()
                window.location.reload()
              }}
            >
              {backendVersion()}
            </UpgradeButton>
          </Tooltip.Trigger>

          <Show when={backendRelease()?.changelog}>
            <Tooltip.Content class="z-50">
              <Tooltip.Arrow class="text-neutral" />

              <Changelog body={backendRelease()!.changelog!} />
            </Tooltip.Content>
          </Show>
        </Tooltip.Anchor>
      </Tooltip>
    </div>
  )
}
