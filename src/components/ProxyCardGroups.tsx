import InfiniteScroll from 'solid-infinite-scroll'
import { createMemo, createSignal } from 'solid-js'
import { ProxyNodeCard } from '~/components'

export const ProxyCardGroups = (props: {
  proxies: string[]
  now?: string
  onClick?: (name: string) => void
}) => {
  const [maxRender, setMaxRender] = createSignal(100)
  const proxies = createMemo(() => props.proxies.slice(0, maxRender()))

  return (
    <InfiniteScroll
      each={proxies()}
      hasMore={proxies().length < props.proxies.length}
      next={() => setMaxRender(maxRender() + 30)}
    >
      {(proxy) => (
        <ProxyNodeCard
          proxyName={proxy}
          isSelected={props.now === proxy}
          onClick={() => {
            props.onClick?.(proxy!)
          }}
        />
      )}
    </InfiniteScroll>
  )
}
