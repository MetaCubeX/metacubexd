import type { JSX, ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { PROXIES_DISPLAY_MODE } from '~/constants'
import { proxiesDisplayMode } from '~/signals'

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

  const isListMode = () => proxiesDisplayMode() === PROXIES_DISPLAY_MODE.LIST

  return (
    <div
      class={twMerge(
        getCollapseClassName(),
        'collapse-arrow collapse border-secondary bg-base-200 shadow-md select-none',
      )}
    >
      <div
        class="collapse-title pr-4 text-xl font-medium after:top-8!"
        onClick={() => onCollapse(!props.isOpen)}
      >
        {title}
      </div>

      <div
        class={twMerge(
          getCollapseContentClassName(),
          'collapse-content transition-opacity duration-1000',
          isListMode() ? 'flex flex-col gap-1' : 'grid gap-2',
        )}
        style={
          isListMode()
            ? undefined
            : 'grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))'
        }
      >
        <Show when={props.isOpen}>{children(() => props.children)()}</Show>
      </div>
    </div>
  )
}
