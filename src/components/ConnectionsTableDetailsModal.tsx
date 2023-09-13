import { Component, Show } from 'solid-js'
import { allConnections } from '~/signals'

export const ConnectionsTableDetailsModal: Component<{
  selectedConnectionID?: string
}> = (props) => {
  return (
    <dialog
      id="connections-table-details-modal"
      class="modal modal-bottom sm:modal-middle"
    >
      <div class="modal-box">
        <Show when={props.selectedConnectionID}>
          <pre>
            <code>
              {JSON.stringify(
                allConnections.find(
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
