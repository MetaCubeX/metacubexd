import type { JSX, ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { renderProxiesInTwoColumns } from '~/signals'

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

  const gridStyle = createMemo(() => {
    if (renderProxiesInTwoColumns()) {
      return 'lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
    }

    return 'sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10'
  })

  return (
    <div
      class={twMerge(
        getCollapseClassName(),
        'collapse collapse-arrow select-none border-secondary bg-base-200 shadow-md',
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
          gridStyle(),
          'collapse-content grid grid-cols-2 gap-2 transition-opacity duration-1000',
        )}
      >
        <Show when={props.isOpen}>{children(() => props.children)()}</Show>
      </div>
    </div>
  )
}
