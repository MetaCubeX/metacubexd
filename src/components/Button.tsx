import type { JSX, ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

interface ButtonBaseProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  disabled?: boolean
}

interface ButtonWithIconProps extends ButtonBaseProps {
  icon: JSX.Element
  children?: JSX.Element
}

interface ButtonWithoutIconProps extends ButtonBaseProps {
  icon?: JSX.Element
  children: JSX.Element
}

export const Button: ParentComponent<
  ButtonWithIconProps | ButtonWithoutIconProps
> = (props) => {
  // @ts-expect-error Expression produces a union type that is too complex to represent
  const [local, others] = splitProps(props, ['class', 'loading', 'icon'])

  return (
    <button
      class={twMerge(
        'btn flex items-center leading-8',
        local.loading ? 'btn-disabled' : local.class,
      )}
      {...others}
    >
      <Show when={local.loading}>
        <div class="loading loading-spinner" />
      </Show>

      <span
        class="truncate rounded-none"
        classList={{
          'flex-1': !local.icon,
        }}
      >
        {props.icon || props.children}
      </span>
    </button>
  )
}
