import { createWindowSize } from '@solid-primitives/resize-observer'
import { ResolvedJSXElement, type ParentComponent } from 'solid-js'
import { renderProxiesInTwoColumns } from '~/signals'

export const ProxiesRenderWarpper: ParentComponent = (props) => {
  const windowSize = createWindowSize()
  const isBiggerScreen = createMemo(() => windowSize.width > 480)

  return () => {
    const content = children(() => props.children) as () => ResolvedJSXElement[]
    const filterContent = (target: number) => {
      return content()
        ?.filter((_: ResolvedJSXElement, index: number) => index % 2 === target)
        .map((proxy) => {
          return <div class="mb-2">{proxy}</div>
        })
    }

    if (renderProxiesInTwoColumns() && isBiggerScreen()) {
      return (
        <div class="flex gap-2">
          <div class="flex-1">{filterContent(0)}</div>
          <div class="flex-1">{filterContent(1)}</div>
        </div>
      )
    }

    return (
      <div class={'grid grid-cols-1 place-items-start gap-2'}>{content()}</div>
    )
  }
}
