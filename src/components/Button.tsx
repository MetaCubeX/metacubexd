import { JSX, ParentComponent, Show, splitProps } from 'solid-js'
import { twMerge } from 'tailwind-merge'

export const Button: ParentComponent<
  JSX.HTMLAttributes<HTMLButtonElement> & {
    loading?: boolean
  }
> = (props) => {
  const [local, others] = splitProps(props, ['class', 'loading'])

  return (
    <button
      class={twMerge('btn', local.loading ? 'btn-disabled' : local.class)}
      {...others}
    >
      <Show when={local.loading}>
        <span class="loading loading-spinner" />
      </Show>

      {props.children}
    </button>
  )
}
