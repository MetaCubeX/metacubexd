import { Show, createEffect, createMemo, createSignal } from 'solid-js'
import { LATENCY_QUALITY_MAP_HTTP } from '~/constants'
import { latencyQualityMap, useProxies } from '~/signals'

export const Latency = (props: { name?: string }) => {
  const { delayMap } = useProxies()
  const [textClassName, setTextClassName] = createSignal('')
  const delay = createMemo(() => {
    return delayMap()[props.name!]
  })

  createEffect(() => {
    setTextClassName('text-success')

    if (delay() > latencyQualityMap().HIGH) {
      setTextClassName('text-error')
    } else if (delay() > latencyQualityMap().MEDIUM) {
      setTextClassName('text-warning')
    }
  })

  return (
    <>
      <Show
        when={
          typeof delay() === 'number' &&
          delay() !== LATENCY_QUALITY_MAP_HTTP.NOT_CONNECTED
        }
      >
        <span class={textClassName()}>{delay()}ms</span>
      </Show>
    </>
  )
}
