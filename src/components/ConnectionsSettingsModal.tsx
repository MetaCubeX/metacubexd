import { useI18n } from '@solid-primitives/i18n'
import type {
  DragEventHandler,
  Draggable,
  Droppable,
} from '@thisbeyond/solid-dnd'
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  closestCenter,
  createSortable,
  useDragDropContext,
} from '@thisbeyond/solid-dnd'
import { Component, For, Show, createSignal } from 'solid-js'
import { Button, ConfigTitle } from '~/components'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  MODAL,
  TAILWINDCSS_SIZE,
} from '~/constants'
import { connectionsTableSize, setConnectionsTableSize } from '~/signals'

type ColumnVisibility = Partial<Record<CONNECTIONS_TABLE_ACCESSOR_KEY, boolean>>
type ColumnOrder = CONNECTIONS_TABLE_ACCESSOR_KEY[]

export const ConnectionsSettingsModal = (props: {
  order: ColumnOrder
  visible: ColumnVisibility
  onOrderChange: (value: ColumnOrder) => void
  onVisibleChange: (value: ColumnVisibility) => void
}) => {
  const [t] = useI18n()
  const [activeKey, setActiveKey] =
    createSignal<CONNECTIONS_TABLE_ACCESSOR_KEY | null>(null)

  const onDragStart = ({ draggable }: { draggable: Draggable }) =>
    setActiveKey(draggable.id as CONNECTIONS_TABLE_ACCESSOR_KEY)
  const onDragEnd = ({
    draggable,
    droppable,
  }: {
    draggable: Draggable
    droppable: Droppable
  }) => {
    if (draggable && droppable) {
      const currentItems = props.order
      const fromIndex = currentItems.indexOf(
        draggable.id as CONNECTIONS_TABLE_ACCESSOR_KEY,
      )
      const toIndex = currentItems.indexOf(
        droppable.id as CONNECTIONS_TABLE_ACCESSOR_KEY,
      )

      if (fromIndex !== toIndex) {
        const updatedItems = currentItems.slice()

        updatedItems.splice(toIndex, 0, ...updatedItems.splice(fromIndex, 1))
        props.onOrderChange(updatedItems)
      }
    }
  }

  const FormRow: Component<{
    key: CONNECTIONS_TABLE_ACCESSOR_KEY
  }> = ({ key }) => {
    const sortable = createSortable(key)
    const [state] = useDragDropContext()!

    return (
      <div
        use:sortable
        class="sortable"
        classList={{
          'opacity-25': sortable.isActiveDraggable,
          'transition-transform': !!state.active.draggable,
        }}
      >
        <div class="flex cursor-grab justify-between py-2">
          <span class="select-none">{t(key)}</span>

          <input
            type="checkbox"
            class="toggle"
            checked={props.visible[key]}
            onChange={(e) => {
              props.onVisibleChange({
                ...props.visible,
                [key]: e.target.checked,
              })
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <dialog
      id={MODAL.CONNECTIONS_SETTINGS}
      class="modal modal-bottom sm:modal-middle"
    >
      <div
        class="modal-box flex flex-col gap-4"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div>
          <ConfigTitle withDivider>{t('tableSize')}</ConfigTitle>

          <select
            class="select select-bordered w-full"
            value={connectionsTableSize()}
            onChange={(e) =>
              setConnectionsTableSize(e.target.value as TAILWINDCSS_SIZE)
            }
          >
            <For each={Object.values(TAILWINDCSS_SIZE)}>
              {(value) => <option value={value}>{t(value)}</option>}
            </For>
          </select>
        </div>

        <div>
          <ConfigTitle withDivider>{t('sort')}</ConfigTitle>

          <DragDropProvider
            onDragStart={onDragStart}
            onDragEnd={onDragEnd as DragEventHandler}
            collisionDetector={closestCenter}
          >
            <DragDropSensors />

            <SortableProvider ids={props.order}>
              <For each={props.order}>{(key) => <FormRow key={key} />}</For>
            </SortableProvider>

            <DragOverlay>
              <Show when={activeKey()}>
                <div>{t(activeKey()!)}</div>
              </Show>
            </DragOverlay>
          </DragDropProvider>
        </div>

        <div class="modal-action">
          <Button
            class="btn-neutral btn-sm ml-auto mt-4 block"
            onClick={() => {
              props.onOrderChange(CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER)
              props.onVisibleChange(CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY)
            }}
          >
            {t('reset')}
          </Button>
        </div>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button />
      </form>
    </dialog>
  )
}
