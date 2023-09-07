import InfiniteScroll from 'solid-infinite-scroll'
import { createMemo, createSignal } from 'solid-js'
import { ProxyNodeCard } from '~/components'

export const ProxyCardGroups = (props: {
  proxyNames: string[]
  now?: string
  onClick?: (name: string) => void
}) => {
  const [maxRender, setMaxRender] = createSignal(100)
  const proxyNames = createMemo(() => props.proxyNames.slice(0, maxRender()))

  return (
    <InfiniteScroll
      each={proxyNames()}
      hasMore={proxyNames().length < props.proxyNames.length}
      next={() => setMaxRender(maxRender() + 30)}
    >
      {(proxy) => (
        <ProxyNodeCard
          proxyName={proxy}
          isSelected={props.now === proxy}
          onClick={props.onClick && (() => props.onClick?.(proxy))}
        />
      )}
    </InfiniteScroll>
  )
}
