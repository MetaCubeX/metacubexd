import { Latency } from '~/components'
import { latencyQualityMap, useProxies } from '~/signals'

export const ProxyPreviewBar = (props: {
  proxyNameList: string[]
  now?: string
}) => {
  const { getLatencyByName } = useProxies()
  const latencyList = createMemo(() =>
    props.proxyNameList.map((name) => getLatencyByName(name)),
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
      <div class="my-1 flex flex-1 items-center justify-center overflow-hidden rounded-2xl [&>*]:h-2">
        <div
          class="bg-success"
          style={{
            width: `${(good() * 100) / all()}%`, // cant use tw class, otherwise dynamic classname won't be generated
          }}
        />
        <div
          class="bg-warning"
          style={{
            width: `${(middle() * 100) / all()}%`,
          }}
        />
        <div
          class="bg-error"
          style={{
            width: `${(slow() * 100) / all()}%`,
          }}
        />
        <div
          class="bg-neutral"
          style={{
            width: `${(notConnected() * 100) / all()}%`,
          }}
        />
      </div>

      <Latency name={props.now} />
    </div>
  )
}
