import { createMemo } from 'solid-js'
import { Latency } from '~/components'
import { latencyQualityMap, useProxies } from '~/signals'

export const ProxyPreviewBar = (props: {
  proxyNameList: string[]
  now?: string
}) => {
  const { latencyMap } = useProxies()
  const latencyList = createMemo(() =>
    props.proxyNameList.map((name) => latencyMap()[name]),
  )

  const all = createMemo(() => latencyList().length)
  const good = createMemo(
    () =>
      latencyList().filter(
        (latency) =>
          latency > latencyQualityMap().NOT_CONNECTED &&
          latency <= latencyQualityMap().MEDIUM,
      ).length,
  )
  const middle = createMemo(
    () =>
      latencyList().filter(
        (latency) =>
          latency > latencyQualityMap().MEDIUM &&
          latency <= latencyQualityMap().HIGH,
      ).length,
  )
  const slow = createMemo(
    () =>
      latencyList().filter((latency) => latency > latencyQualityMap().HIGH)
        .length,
  )
  const notConnected = createMemo(
    () =>
      latencyList().filter(
        (latency) => latency === latencyQualityMap().NOT_CONNECTED,
      ).length,
  )

  return (
    <div class="flex items-center gap-2 py-2">
      <div class="flex flex-1 overflow-hidden rounded-2xl">
        <div
          class="h-2 bg-success"
          style={{
            width: `${(good() * 100) / all()}%`, // cant use tw class, otherwise dynamic classname won't be generated
          }}
        />
        <div
          class="h-2 bg-warning"
          style={{
            width: `${(middle() * 100) / all()}%`,
          }}
        />
        <div
          class="h-2 bg-error"
          style={{
            width: `${(slow() * 100) / all()}%`,
          }}
        />
        <div
          class="h-2 bg-neutral"
          style={{
            width: `${(notConnected() * 100) / all()}%`,
          }}
        />
      </div>

      <Latency name={props.now} />
    </div>
  )
}
