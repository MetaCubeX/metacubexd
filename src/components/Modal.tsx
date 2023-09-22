import { IconX } from '@tabler/icons-solidjs'
import { JSX, ParentComponent, Show, children } from 'solid-js'
import { Button } from '~/components'

type Props = {
  ref?: (el: HTMLDialogElement) => void
  title?: JSX.Element
  action?: JSX.Element
}

export const Modal: ParentComponent<Props> = (props) => {
  let dialogRef: HTMLDialogElement | undefined

  return (
    <dialog
      ref={(el) => (dialogRef = el) && props.ref?.(el)}
      class="modal modal-bottom sm:modal-middle"
    >
      <div class="modal-box p-0" onContextMenu={(e) => e.preventDefault()}>
        <div class="sticky top-0 z-50 flex items-center justify-between bg-base-100 bg-opacity-80 p-6 backdrop-blur-xl">
          <div class="flex items-center gap-4 text-xl font-bold">
            {props.title}
          </div>
          <Button
            class="btn-circle btn-sm"
            onClick={() => {
              dialogRef?.close()
            }}
            icon={<IconX size={20} />}
          />
        </div>

        <div class="p-6 pt-3">
          {children(() => props.children)()}

          <Show when={props.action}>
            <div class="modal-action">
              <div class="flex justify-end gap-2">{props.action}</div>
            </div>
          </Show>
        </div>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button />
      </form>
    </dialog>
  )
}
