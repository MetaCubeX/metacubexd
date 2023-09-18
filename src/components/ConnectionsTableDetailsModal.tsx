import { Component, Show } from 'solid-js'
import { MODAL } from '~/constants'
import { allConnections } from '~/signals'
import { Button } from './Button'

export const ConnectionsTableDetailsModal: Component<{
  selectedConnectionID?: string
}> = (props) => {
  const modalID = MODAL.CONNECTIONS_TABLE_DETAILS

  return (
    <dialog id={modalID} class="modal modal-bottom sm:modal-middle">
      <div class="modal-box">
        <div class="sticky top-0 z-50 flex items-center justify-end">
          <Button
            class="btn-circle btn-sm text-xl"
            onClick={() => {
              const modal = document.querySelector(
                `#${modalID}`,
              ) as HTMLDialogElement | null

              modal?.close()
            }}
          >
            ✕
          </Button>
        </div>

        <Show when={props.selectedConnectionID}>
          <pre>
            <code>
              {JSON.stringify(
                allConnections().find(
                  ({ id }) => id === props.selectedConnectionID,
                ),
                null,
                2,
              )}
            </code>
          </pre>
        </Show>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button />
      </form>
    </dialog>
  )
}
