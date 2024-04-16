import { IconX } from '@tabler/icons-solidjs'
import type { JSX, ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button } from '~/components'

type Props = {
  ref?: (el: HTMLDialogElement) => void
  icon?: JSX.Element
  title?: JSX.Element
  action?: JSX.Element
}

const actionClassName =
  'sticky bottom-0 z-50 flex items-center justify-end bg-base-100 bg-opacity-80 p-4 backdrop-blur'

export const Modal: ParentComponent<Props> = (props) => {
  let dialogRef: HTMLDialogElement | undefined

  return (
    <dialog
      ref={(el) => (dialogRef = el) && props.ref?.(el)}
      class="modal modal-bottom sm:modal-middle"
    >
      <div class="modal-box p-0" onContextMenu={(e) => e.preventDefault()}>
        <div class={twMerge(actionClassName, 'top-0 justify-between')}>
          <div class="flex items-center gap-4 text-xl font-bold">
            {props.icon}

            <span>{props.title}</span>
          </div>

          <Button
            class="btn-circle btn-sm"
            onClick={() => dialogRef?.close()}
            icon={<IconX size={20} />}
          />
        </div>

        <div class="p-4">{children(() => props.children)()}</div>

        <Show when={props.action}>
          <div class={actionClassName}>
            <div class="flex justify-end gap-2">{props.action}</div>
          </div>
        </Show>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button />
      </form>
    </dialog>
  )
}
