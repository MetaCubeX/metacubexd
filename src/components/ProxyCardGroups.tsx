import { For } from 'solid-js'
import { ProxyNodeCard } from '~/components'

export const ProxyCardGroups = (props: {
  proxyNames: string[]
  now?: string
  onClick?: (name: string) => void
}) => {
  return (
    <For each={props.proxyNames}>
      {(proxy) => (
        <ProxyNodeCard
          proxyName={proxy}
          isSelected={props.now === proxy}
          onClick={props.onClick && (() => props.onClick?.(proxy))}
        />
      )}
    </For>
  )
}
