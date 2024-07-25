import { useProxies } from '~/signals'
import { proxyIPv6SupportMap } from '~/signals/ipv6'

export const IPv6Support = (props: { name?: string; class?: string }) => {
  const { getNowProxyNodeName } = useProxies()

  const support = createMemo(() => {
    return proxyIPv6SupportMap()[getNowProxyNodeName(props.name || '')]
  })

  return (
    <Show when={support()}>
      <span class={`scale-75 ${props.class}`}>IPv6</span>
    </Show>
  )
}
