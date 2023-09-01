import InfiniteScroll from 'solid-infinite-scroll'
import { createMemo, createSignal } from 'solid-js'
import ProxyNodeCard from './ProxyNodeCard'

export default (props: { proxies: string[]; now?: string }) => {
  const [maxRender, setMaxRender] = createSignal(30)
  const proxies = createMemo(() => props.proxies.slice(0, maxRender()))

  return (
    <InfiniteScroll
      each={proxies()}
      hasMore={proxies().length < props.proxies.length}
      next={() => setMaxRender(maxRender() + 30)}
    >
      {(proxy) => (
        <ProxyNodeCard proxyName={proxy} isSelected={props.now === proxy} />
      )}
    </InfiniteScroll>
  )
}
