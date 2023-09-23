import { createForm } from '@felte/solid'
import { validator } from '@felte/validator-zod'
import { IconNetwork, IconX } from '@tabler/icons-solidjs'
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
import { uniq } from 'lodash'
import { Component, For, Index, Show, createSignal } from 'solid-js'
import { z } from 'zod'
import { Button, ConfigTitle, Modal } from '~/components'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  TAILWINDCSS_SIZE,
} from '~/constants'
import { useI18n } from '~/i18n'
import {
  allConnections,
  clientSourceIPTags,
  connectionsTableSize,
  setClientSourceIPTags,
  setConnectionsTableSize,
} from '~/signals'
import {
  ConnectionsTableColumnOrder,
  ConnectionsTableColumnVisibility,
} from '~/types'

const TagClientSourceIPWithNameForm: Component = () => {
  const schema = z.object({
    tagName: z.string().nonempty(),
    sourceIP: z.string().nonempty(),
  })

  const [t] = useI18n()

  const { form, reset } = createForm<z.infer<typeof schema>>({
    extend: validator({ schema }),
    onSubmit: ({ tagName, sourceIP }) => {
      setClientSourceIPTags((tags) => {
        if (
          tags.some(
            (tag) => tag.tagName === tagName || tag.sourceIP === sourceIP,
          )
        ) {
          return tags
        }

        return [...tags, { tagName, sourceIP }]
      })

      reset()
    },
  })

  return (
    <form use:form={form}>
      <div class="join flex">
        <select name="sourceIP" class="select join-item select-bordered">
          <option />

          <Index
            each={uniq(
              allConnections().map(({ metadata: { sourceIP } }) => sourceIP),
            )
              .sort()
              .filter(
                (sourceIP) =>
                  !clientSourceIPTags().some(
                    ({ sourceIP: tagSourceIP }) => tagSourceIP === sourceIP,
                  ),
              )}
          >
            {(sourceIP) => (
              <option class="badge" value={sourceIP()}>
                {sourceIP()}
              </option>
            )}
          </Index>
        </select>

        <input
          name="tagName"
          class="input join-item input-bordered min-w-0 flex-1"
          placeholder="name"
        />

        <Button type="submit" class="join-item">
          {t('tag')}
        </Button>
      </div>
    </form>
  )
}

export const ConnectionsSettingsModal = (props: {
  ref?: (el: HTMLDialogElement) => void
  order: ConnectionsTableColumnOrder
  visible: ConnectionsTableColumnVisibility
  onOrderChange: (value: ConnectionsTableColumnOrder) => void
  onVisibleChange: (value: ConnectionsTableColumnVisibility) => void
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
    <Modal
      ref={(el) => props.ref?.(el)}
      icon={<IconNetwork size={24} />}
      title={t('connectionsSettings')}
      action={
        <Button
          class="btn-neutral btn-sm"
          onClick={() => {
            props.onOrderChange(CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER)
            props.onVisibleChange(CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY)
          }}
        >
          {t('reset')}
        </Button>
      }
    >
      <div class="flex flex-col gap-4">
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
          <ConfigTitle withDivider>
            {t('tagClientSourceIPWithName')}
          </ConfigTitle>

          <div class="flex flex-col gap-4">
            <TagClientSourceIPWithNameForm />

            <div class="flex flex-col gap-2">
              <For each={clientSourceIPTags()}>
                {({ tagName, sourceIP }) => (
                  <div class="badge badge-primary w-full items-center justify-between gap-2 py-4">
                    <span class="truncate">
                      {tagName} ({sourceIP})
                    </span>

                    <Button
                      class="btn-circle btn-ghost btn-xs"
                      onClick={() =>
                        setClientSourceIPTags((tags) =>
                          tags.filter((tag) => tag.tagName !== tagName),
                        )
                      }
                      icon={<IconX size={12} />}
                    />
                  </div>
                )}
              </For>
            </div>
          </div>
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
      </div>
    </Modal>
  )
}
