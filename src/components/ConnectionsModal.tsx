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
import { Button } from '~/components'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
} from '~/constants'

type ColumnVisibility = Partial<Record<CONNECTIONS_TABLE_ACCESSOR_KEY, boolean>>
type ColumnOrder = CONNECTIONS_TABLE_ACCESSOR_KEY[]

export const ConnectionsTableOrderingModal = (props: {
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
        <div class="m-1 flex cursor-grab justify-between p-1">
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
    <>
      <input type="checkbox" id="connection-modal" class="modal-toggle" />
      <div class="modal">
        <div class="modal-box w-80">
          <DragDropProvider
            onDragStart={onDragStart}
            onDragEnd={onDragEnd as DragEventHandler}
            collisionDetector={closestCenter}
          >
            <DragDropSensors />
            <div class="column self-stretch">
              <SortableProvider ids={props.order}>
                <For each={props.order}>{(key) => <FormRow key={key} />}</For>
              </SortableProvider>
            </div>
            <DragOverlay>
              <Show when={activeKey()}>
                <div class="sortable">{t(activeKey()!)}</div>
              </Show>
            </DragOverlay>
          </DragDropProvider>

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

        <label class="modal-backdrop" for="connection-modal" />
      </div>
    </>
  )
}
