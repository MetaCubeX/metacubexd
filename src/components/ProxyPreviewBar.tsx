import { Latency } from '~/components'
import { latencyQualityMap, useProxies } from '~/signals'

export const ProxyPreviewBar = (props: {
  proxyNameList: string[]
  testUrl: string | null
  now?: string
}) => {
  const { getLatencyByName } = useProxies()
  const latencyList = createMemo(() =>
    props.proxyNameList.map((name) => getLatencyByName(name, props.testUrl)),
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
    <div class="flex items-center gap-2">
      <div class="my-1 flex flex-1 items-center justify-center overflow-hidden rounded-2xl [&>*]:h-2">
        <div
          class="bg-green-600"
          style={{
            width: `${(good() * 100) / all()}%`, // cant use tw class, otherwise dynamic classname won't be generated
          }}
        />
        <div
          class="bg-yellow-500"
          style={{
            width: `${(middle() * 100) / all()}%`,
          }}
        />
        <div
          class="bg-red-500"
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

      <Show when={props.now}>
        <Latency proxyName={props.now!} testUrl={props.testUrl} />
      </Show>
    </div>
  )
}
