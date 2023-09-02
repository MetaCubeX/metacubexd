import { createMemo } from 'solid-js'
import { Latency } from '~/components'
import { latencyQualityMap, useProxies } from '~/signals'

export const ProxyPreviewBar = (props: {
  proxyNameList: string[]
  now?: string
}) => {
  const { latencyMap } = useProxies()
  const delayList = createMemo(() =>
    props.proxyNameList.map((i) => latencyMap()[i]),
  )
  const all = createMemo(() => delayList().length)
  const good = createMemo(
    () =>
      delayList().filter(
        (delay) =>
          delay > latencyQualityMap().NOT_CONNECTED &&
          delay <= latencyQualityMap().MEDIUM,
      ).length,
  )
  const middle = createMemo(
    () =>
      delayList().filter(
        (delay) =>
          delay > latencyQualityMap().NOT_CONNECTED &&
          delay <= latencyQualityMap().HIGH,
      ).length,
  )
  const slow = createMemo(
    () =>
      delayList().filter((delay) => delay > latencyQualityMap().HIGH).length,
  )
  const notConnected = createMemo(
    () =>
      delayList().filter(
        (delay) =>
          delay === latencyQualityMap().NOT_CONNECTED ||
          typeof delay !== 'number',
      ).length,
  )

  return (
    <div class="flex h-6 w-full items-center">
      <div class="flex flex-1 overflow-hidden rounded-2xl">
        <div
          class="h-2 bg-success"
          style={{
            width: `${(good() * 100) / all()}%`, // cant use tw class cause dynamic classname wont import
          }}
        ></div>
        <div
          class="h-2 bg-warning"
          style={{
            width: `${(middle() * 100) / all()}%`,
          }}
        ></div>
        <div
          class="h-2 bg-error"
          style={{
            width: `${(slow() * 100) / all()}%`,
          }}
        ></div>
        <div
          class="h-2 bg-neutral"
          style={{
            width: `${(notConnected() * 100) / all()}%`,
          }}
        ></div>
      </div>
      <div class="ml-3 w-8 text-xs">
        <Latency name={props.now} />
      </div>
    </div>
  )
}
