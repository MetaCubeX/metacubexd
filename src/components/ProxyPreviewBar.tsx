import { createMemo } from 'solid-js'
import { Delay } from '~/components'
import { DELAY } from '~/constants'
import { useProxies } from '~/signals'

export const ProxyPreviewBar = (props: {
  proxyNameList: string[]
  now?: string
}) => {
  const { delayMap } = useProxies()
  const delayList = createMemo(() =>
    props.proxyNameList.map((i) => delayMap()[i]),
  )
  const all = createMemo(() => delayList().length)
  const good = createMemo(
    () =>
      delayList().filter(
        (delay) => delay > DELAY.NOT_CONNECTED && delay <= DELAY.MEDIUM,
      ).length,
  )
  const middle = createMemo(
    () =>
      delayList().filter((delay) => delay > DELAY.MEDIUM && delay <= DELAY.HIGH)
        .length,
  )
  const slow = createMemo(
    () => delayList().filter((delay) => delay > DELAY.HIGH).length,
  )
  const notConnected = createMemo(
    () =>
      delayList().filter(
        (delay) => delay === DELAY.NOT_CONNECTED || typeof delay !== 'number',
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
        <Delay name={props.now} />
      </div>
    </div>
  )
}
