import { Show, createEffect, createMemo, createSignal } from 'solid-js'
import { LATENCY_QUALITY_MAP_HTTP } from '~/constants'
import { useI18n } from '~/i18n'
import { latencyQualityMap, useProxies } from '~/signals'

export const Latency = (props: { name?: string }) => {
  const [t] = useI18n()
  const { latencyMap } = useProxies()
  const [textClassName, setTextClassName] = createSignal('')
  const latency = createMemo(() => {
    return latencyMap()[props.name!]
  })

  createEffect(() => {
    setTextClassName('text-success')

    if (latency() > latencyQualityMap().HIGH) {
      setTextClassName('text-error')
    } else if (latency() > latencyQualityMap().MEDIUM) {
      setTextClassName('text-warning')
    }
  })

  return (
    <Show
      when={
        typeof latency() === 'number' &&
        latency() !== LATENCY_QUALITY_MAP_HTTP.NOT_CONNECTED
      }
    >
      <span class={`whitespace-nowrap text-xs ${textClassName()}`}>
        {latency()}
        {t('ms')}
      </span>
    </Show>
  )
}
