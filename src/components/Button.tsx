import { JSX, ParentComponent, Show, splitProps } from 'solid-js'
import { twMerge } from 'tailwind-merge'

export const Button: ParentComponent<
  JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean
    disabled?: boolean
    icon?: JSX.Element
  }
> = (props) => {
  const [local, others] = splitProps(props, [
    'class',
    'loading',
    'disabled',
    'icon',
  ])

  return (
    <button
      class={twMerge(
        'btn flex items-center',
        local.loading ? 'btn-disabled' : local.class,
      )}
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
        <div class="loading loading-spinner" />
      </Show>

      <span
        class="truncate"
        classList={{
          'flex-1': !local.icon,
        }}
      >
        {props.icon || props.children}
      </span>
    </button>
  )
}
