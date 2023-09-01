import { JSX, Show, createMemo, createSignal } from 'solid-js'

const [windowWidth, setWindowWidth] = createSignal(0)

setWindowWidth(document?.body?.clientWidth)

window.addEventListener('resize', () => {
  setWindowWidth(document.body.clientWidth)
})

const ForTwoLine = (props: { subChild: JSX.Element[] }) => {
  const isWidder = createMemo(() => windowWidth() >= 640) // 640 is sm size in daisyui
  const leftLine = createMemo(() =>
    props.subChild.filter((i, index) => index % 2 === 0 || !isWidder()),
  )
  const rightLine = createMemo(() =>
    props.subChild.filter((i, index) => index % 2 === 1),
  )

  return (
    <div class="flex">
      <div class="flex flex-1 flex-col">{leftLine()}</div>
      <Show when={isWidder()}>
        <div class="ml-2 flex flex-1 flex-col">{rightLine()}</div>
      </Show>
    </div>
  )
}

export default ForTwoLine
