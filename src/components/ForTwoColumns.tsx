import { JSX, Show, createMemo } from 'solid-js'
import { useWindowWidth } from '~/helpers'
import { renderInTwoColumn } from '~/signals'

export const ForTwoColumns = (props: { subChild: JSX.Element[] }) => {
  const { windowWidth } = useWindowWidth()
  const isShowTwoColumns = createMemo(
    () => windowWidth() >= 640 && renderInTwoColumn(),
  ) // 640 is sm size in daisyui
  const leftCloumns = createMemo(() =>
    props.subChild.filter((_, index) => index % 2 === 0 || !isShowTwoColumns()),
  )
  const rightCloumns = createMemo(() =>
    props.subChild.filter((_, index) => index % 2 === 1),
  )

  return (
    <div class="flex">
      <div class="flex flex-1 flex-col">{leftCloumns()}</div>
      <Show when={isShowTwoColumns()}>
        <div class="ml-2 flex flex-1 flex-col">{rightCloumns()}</div>
      </Show>
    </div>
  )
}
