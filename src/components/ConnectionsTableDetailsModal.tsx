import { IconNetwork } from '@tabler/icons-solidjs'
import { Component, Show } from 'solid-js'
import { useI18n } from '~/i18n'
import { allConnections } from '~/signals'
import { Modal } from './Modal'

export const ConnectionsTableDetailsModal: Component<{
  ref?: (el: HTMLDialogElement) => void
  selectedConnectionID?: string
}> = (props) => {
  const { t } = useI18n()

  return (
    <Modal
      ref={(el) => props.ref?.(el)}
      title={
        <>
          <IconNetwork size={24} />
          <span>{t('connectionsDetails')}</span>
        </>
      }
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
