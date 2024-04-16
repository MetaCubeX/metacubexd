import { createWindowSize } from '@solid-primitives/resize-observer'
import type { ParentComponent } from 'solid-js'

export const RenderInTwoColumns: ParentComponent = (props) => {
  const resolvedChildren = children(() => props.children)
  const windowSize = createWindowSize()
  // 640 is sm size in default tailwindcss breakpoint
  const showTwoColumns = createMemo(() => windowSize.width >= 640)

  const leftColumns = createMemo(() =>
    resolvedChildren.toArray().filter((_, index) => index % 2 === 0),
  )

  const rightColumns = createMemo(() =>
    resolvedChildren.toArray().filter((_, index) => index % 2 === 1),
  )

  return (
    <div class="flex flex-col gap-2 sm:flex-row">
      <Show when={showTwoColumns()} fallback={props.children}>
        <div class="flex flex-1 flex-col gap-2">{leftColumns()}</div>
        <div class="flex flex-1 flex-col gap-2">{rightColumns()}</div>
      </Show>
    </div>
  )
}
