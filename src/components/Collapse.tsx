import type { JSX, ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'

type Props = {
  title: JSX.Element
  isOpen?: boolean
  onCollapse: (collapsed: boolean) => void
}

export const Collapse: ParentComponent<Props> = (props) => {
  const { title, onCollapse } = props

  const getCollapseClassName = () => {
    const openedClassName = 'collapse-open'
    const closedClassName = 'collapse-close'

    return props.isOpen ? openedClassName : closedClassName
  }

  const getCollapseContentClassName = () => {
    const openedClassName = 'opacity-100'
    const closedClassName = 'opacity-0'

    return props.isOpen ? openedClassName : closedClassName
  }

  return (
    <div
      class={twMerge(
        getCollapseClassName(),
        'collapse-arrow collapse border-secondary bg-base-200 shadow-md select-none',
      )}
    >
      <div
        class="collapse-title pr-4 text-xl font-medium after:!top-8"
        onClick={() => onCollapse(!props.isOpen)}
      >
        {title}
      </div>

      <div
        class={twMerge(
          getCollapseContentClassName(),
          'collapse-content grid gap-2 transition-opacity duration-1000',
        )}
        style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))"
      >
        <Show when={props.isOpen}>{children(() => props.children)()}</Show>
      </div>
    </div>
  )
}
