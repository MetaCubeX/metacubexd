import { twMerge } from 'tailwind-merge'
import Delay from '~/components/Delay'
import { DELAY } from '~/config/enum'
import { useProxies } from '~/signals/proxies'

export default (props: { proxyNameList: string[]; now?: string }) => {
  const { proxyNodeMap } = useProxies()
  const allNodesDelay = props.proxyNameList.map((i) => proxyNodeMap()[i].delay!)
  const all = allNodesDelay.length
  const good = allNodesDelay.filter(
    (delay) => delay > DELAY.NOT_CONNECTED && delay <= DELAY.MEDIUM,
  ).length
  const middle = allNodesDelay.filter(
    (delay) => delay > DELAY.MEDIUM && delay <= DELAY.HIGH,
  ).length
  const slow = allNodesDelay.filter((delay) => delay > DELAY.HIGH).length
  const notConnected = allNodesDelay.filter(
    (delay) => delay === DELAY.NOT_CONNECTED || typeof delay !== 'number',
  ).length

  return (
    <div class="flex w-full items-center">
      <div class="flex flex-1 overflow-hidden rounded-2xl">
        <div
          class={twMerge('h-2 bg-success')}
          style={{
            width: `${(good * 100) / all}%`, // cant use tw class cause dynamic classname wont import
          }}
        ></div>
        <div
          class={twMerge('h-2 bg-warning')}
          style={{
            width: `${(middle * 100) / all}%`,
          }}
        ></div>
        <div
          class={twMerge('h-2 bg-error')}
          style={{
            width: `${(slow * 100) / all}%`,
          }}
        ></div>
        <div
          class={twMerge('h-2 bg-neutral')}
          style={{
            width: `${(notConnected * 100) / all}%`,
          }}
        ></div>
      </div>
      <div class="ml-4 text-xs">
        <Delay delay={proxyNodeMap()[props.now!]?.delay} />
      </div>
    </div>
  )
}
