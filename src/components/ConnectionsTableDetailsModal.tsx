import { IconNetwork } from '@tabler/icons-solidjs'
import type { Component } from 'solid-js'
import { Modal } from '~/components'
import { useI18n } from '~/i18n'
import { allConnections } from '~/signals'

export const ConnectionsTableDetailsModal: Component<{
  ref?: (el: HTMLDialogElement) => void
  selectedConnectionID?: string
}> = (props) => {
  const [t] = useI18n()

  return (
    <Modal
      ref={(el) => props.ref?.(el)}
      icon={<IconNetwork size={24} />}
      title={t('connectionsDetails')}
    >
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
    </Modal>
  )
}
