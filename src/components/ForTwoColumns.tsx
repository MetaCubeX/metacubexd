import { JSX, Show, createMemo, createSignal } from 'solid-js'
import { renderInTwoColumn } from '~/signals/config'

const [windowWidth, setWindowWidth] = createSignal(0)

setWindowWidth(document?.body?.clientWidth)

window.addEventListener('resize', () => {
  setWindowWidth(document.body.clientWidth)
})

const ForTwoColumns = (props: { subChild: JSX.Element[] }) => {
  const isShowTwoColumns = createMemo(
    () => windowWidth() >= 640 && renderInTwoColumn(),
  ) // 640 is sm size in daisyui
  const leftCloumns = createMemo(() =>
    props.subChild.filter((i, index) => index % 2 === 0 || !isShowTwoColumns()),
  )
  const rightCloumns = createMemo(() =>
    props.subChild.filter((i, index) => index % 2 === 1),
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

export default ForTwoColumns
