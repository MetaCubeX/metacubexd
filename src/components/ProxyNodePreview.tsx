import { For, Show } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import Delay from '~/components/Delay'
import { DELAY, PROXIES_PREVIEW_TYPE } from '~/config/enum'
import { proxiesPreviewType } from '~/pages/Config'
import { useProxies } from '~/signals/proxies'

const DelayDots = (p: { delay: number | undefined; selected: boolean }) => {
  let dotClassName = p.selected
    ? 'bg-white border-4 border-success'
    : 'bg-success'

  if (typeof p.delay !== 'number' || p.delay === DELAY.NOT_CONNECTED) {
    dotClassName = p.selected
      ? 'bg-white border-4 border-neutral'
      : 'bg-neutral'
  } else if (p.delay > DELAY.HIGH) {
    dotClassName = p.selected ? 'bg-white border-4 border-error' : 'bg-error'
  } else if (p.delay > DELAY.MEDIUM) {
    dotClassName = p.selected
      ? 'bg-white border-4 border-warning'
      : 'bg-warning'
  }

  return <div class={twMerge('m-1 h-4 w-4 rounded-full', dotClassName)}></div>
}

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
    (delay) => delay === DELAY.NOT_CONNECTED,
  ).length

  return (
    <>
      <Show when={proxiesPreviewType() === PROXIES_PREVIEW_TYPE.BAR}>
        <div class="flex w-full items-center">
          <div class="flex flex-1 overflow-hidden rounded-2xl">
            <div
              class={twMerge('h-2 w-auto bg-success')}
              style={{
                width: `${(good * 100) / all}%`, // cant use tw class cause dynamic classname wont import
              }}
            ></div>
            <div
              class={twMerge('h-2 w-auto bg-warning')}
              style={{
                width: `${(middle * 100) / all}%`,
              }}
            ></div>
            <div
              class={twMerge('h-2 w-auto bg-error')}
              style={{
                width: `${(slow * 100) / all}%`,
              }}
            ></div>
            <div
              class={twMerge('h-2 w-auto bg-neutral')}
              style={{
                width: `${(notConnected * 100) / all}%`,
              }}
            ></div>
          </div>
          <div class="ml-4 text-xs">
            <Delay delay={proxyNodeMap()[props.now!]?.delay} />
          </div>
        </div>
      </Show>
      <Show when={proxiesPreviewType() === PROXIES_PREVIEW_TYPE.DOTS}>
        <div class="flex w-full flex-wrap items-center">
          <For each={props.proxyNameList.map((name) => proxyNodeMap()[name]!)}>
            {(proxy) => {
              const delay = proxy?.delay
              const isSelected = props.now === proxy.name

              return <DelayDots delay={delay} selected={isSelected} />
            }}
          </For>
        </div>
      </Show>
    </>
  )
}
