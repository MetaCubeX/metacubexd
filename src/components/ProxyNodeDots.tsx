import { For } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { useProxies } from '~/signals/proxies'
import { getClassNameByDelay } from '~/utils/proxies'

const Delay = (p: { delay: number | undefined; selected: boolean }) => {
  const color = getClassNameByDelay(p.delay)
  const bgClassName = `bg-${color}`
  const isSelected = p.selected && `border-2 border-primary`

  return (
    <div
      class={twMerge('m-1 h-4 w-4 rounded-full', bgClassName, isSelected)}
    ></div>
  )
}

export default (props: { proxyNameList: string[]; now?: string }) => {
  const { proxyNodeMap } = useProxies()

  return (
    <div class="flex w-full flex-wrap">
      <For each={props.proxyNameList.map((name) => proxyNodeMap()[name]!)}>
        {(proxy) => {
          const delay = proxy?.delay
          const isSelected = props.now === proxy.name

          return <Delay delay={delay} selected={isSelected} />
        }}
      </For>
    </div>
  )
}
