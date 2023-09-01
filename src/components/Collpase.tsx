import { JSX, ParentComponent, Show } from 'solid-js'
import { twMerge } from 'tailwind-merge'

type Props = {
  title: JSX.Element
  content: JSX.Element
  isOpen: boolean | undefined
  onCollapse: (collapsed: boolean) => void
}

const Collapse: ParentComponent<Props> = (props) => {
  const { title, content, onCollapse } = props

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
        'collapse collapse-arrow overflow-visible border-secondary bg-base-200',
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
          'collapse-content grid auto-rows-min grid-cols-2 gap-2 transition-opacity duration-1000 lg:grid-cols-3 xl:grid-cols-4',
        )}
      >
        <Show when={props.isOpen}>{content}</Show>
      </div>
    </div>
  )
}

export default Collapse
