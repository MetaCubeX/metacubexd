import { For } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { DELAY } from '~/config/enum'
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
  const { delayMap } = useProxies()

  return (
    <div class="flex w-full flex-wrap items-center">
      <For
        each={props.proxyNameList.map((name): [string, number] => [
          name,
          delayMap()[name],
        ])}
      >
        {([name, delay]) => {
          const isSelected = props.now === name

          return <DelayDots delay={delay} selected={isSelected} />
        }}
      </For>
    </div>
  )
}
