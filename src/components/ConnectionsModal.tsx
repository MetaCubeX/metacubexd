import { For } from 'solid-js'
import { AccessorKey } from '~/config/connection'

type ColumnVisibility = Partial<Record<AccessorKey, boolean>>

export default (props: {
  data: ColumnVisibility
  onChange: (value: ColumnVisibility) => void
}) => {
  const { onChange } = props

  return (
    <>
      <input type="checkbox" id="connection-modal" class="modal-toggle" />
      <div class="modal">
        <div class="modal-box w-80">
          <For
            each={Object.values(AccessorKey).filter(
              (i) => ![AccessorKey.Close, AccessorKey.ID].includes(i),
            )}
          >
            {(key) => (
              <div class="m-1 flex justify-between p-1">
                {key}
                <input
                  type="checkbox"
                  class="toggle"
                  checked={props.data[key]}
                  onChange={(e) => {
                    onChange({
                      ...props.data,
                      [key]: e.target.checked,
                    })
                  }}
                />
              </div>
            )}
          </For>
        </div>
        <label class="modal-backdrop" htmlFor="connection-modal">
          Close
        </label>
      </div>
    </>
  )
}
