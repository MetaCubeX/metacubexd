import { Show, createEffect, createMemo, createSignal } from 'solid-js'
import { DELAY } from '~/config/enum'
import { useProxies } from '~/signals/proxies'

const Delay = (props: { name?: string }) => {
  const { proxyNodeMap } = useProxies()
  const [textClassName, setTextClassName] = createSignal('')
  const delay = createMemo(() => {
    return proxyNodeMap()[props.name!]?.delay!
  })

  createEffect(() => {
    setTextClassName('text-success')

    if (delay() > DELAY.HIGH) {
      setTextClassName('text-error')
    } else if (delay() > DELAY.MEDIUM) {
      setTextClassName('text-warning')
    }
  })

  return (
    <>
      <Show
        when={typeof delay() === 'number' && delay() !== DELAY.NOT_CONNECTED}
      >
        <span class={textClassName()}>{delay()}ms</span>
      </Show>
    </>
  )
}

export default Delay
