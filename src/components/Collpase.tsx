import { JSX, ParentComponent } from 'solid-js'
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
    return props.isOpen ? 'collapse-open' : 'collapse-close'
  }
  const getCollapseContentClassName = () => {
    return props.isOpen ? 'opacity-100' : 'opacity-0 scale-y-0'
  }

  return (
    <div
      class={twMerge(
        getCollapseClassName(),
        'collapse collapse-arrow border-secondary bg-base-200 p-1',
      )}
    >
      <div
        class={'collapse-title text-xl font-medium'}
        onClick={() => onCollapse(!props.isOpen)}
      >
        {title}
      </div>
      <div
        class={twMerge(
          getCollapseContentClassName(),
          'collapse-content grid grid-cols-1 gap-2 overflow-hidden transition-opacity duration-1000 sm:grid-cols-3 lg:grid-cols-5',
        )}
      >
        {content}
      </div>
    </div>
  )
}

export default Collapse
