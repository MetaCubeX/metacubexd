import { JSX, ParentComponent, Show, splitProps } from 'solid-js'
import { twMerge } from 'tailwind-merge'

export const Button: ParentComponent<
  JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean
    disabled?: boolean
  }
> = (props) => {
  const [local, others] = splitProps(props, ['class', 'loading', 'disabled'])

  return (
    <button
      class={twMerge('btn', local.loading ? 'btn-disabled' : local.class)}
      {...others}
      onClick={(e) => {
        if (props.disabled) {
          e.preventDefault()
          e.stopPropagation()

          return
        }

        if (typeof props.onClick === 'function') {
          props.onClick(e)
        }
      }}
    >
      <Show when={local.loading}>
        <span class="loading loading-spinner" />
      </Show>

      {props.children}
    </button>
  )
}
