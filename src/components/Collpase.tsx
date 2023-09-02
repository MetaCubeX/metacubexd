import { JSX, ParentComponent, Show, createMemo } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { renderInTwoColumn } from '~/signals'

type Props = {
  title: JSX.Element
  content: JSX.Element
  isOpen: boolean | undefined
  onCollapse: (collapsed: boolean) => void
}

export const Collapse: ParentComponent<Props> = (props) => {
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

  const mediaQueryClassName = createMemo(() => {
    if (renderInTwoColumn()) {
      return 'lg:grid-cols-3 xl:grid-cols-4'
    } else {
      return 'sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
    }
  })

  return (
    <div
      class={twMerge(
        getCollapseClassName(),
        'collapse collapse-arrow mb-2 select-none overflow-visible border-secondary bg-base-200',
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
          mediaQueryClassName(),
          'collapse-content grid auto-rows-min grid-cols-2 gap-2 transition-opacity duration-1000',
        )}
      >
        <Show when={props.isOpen}>{content}</Show>
      </div>
    </div>
  )
}
