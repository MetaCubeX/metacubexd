import { createWindowSize } from '@solid-primitives/resize-observer'
import { JSX, Show, createMemo } from 'solid-js'
import { renderInTwoColumns } from '~/signals'

export const ForTwoColumns = (props: { subChild: JSX.Element[] }) => {
  const windowSize = createWindowSize()
  const isShowTwoColumns = createMemo(
    () => windowSize.width >= 640 && renderInTwoColumns(),
  ) // 640 is sm size in daisyui
  const leftColumns = createMemo(() =>
    props.subChild.filter((_, index) => index % 2 === 0 || !isShowTwoColumns()),
  )
  const rightColumns = createMemo(() =>
    props.subChild.filter((_, index) => index % 2 === 1),
  )

  return (
    <div class="flex">
      <div class="flex flex-1 flex-col">{leftColumns()}</div>
      <Show when={isShowTwoColumns()}>
        <div class="ml-2 flex flex-1 flex-col">{rightColumns()}</div>
      </Show>
    </div>
  )
}
