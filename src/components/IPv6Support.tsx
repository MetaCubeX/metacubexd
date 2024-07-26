import { useProxies } from '~/signals'
import { proxyIPv6SupportMap } from '~/signals/ipv6'

export const IPv6Support = (props: { name?: string }) => {
  const { getNowProxyNodeName } = useProxies()

  const support = createMemo(() => {
    return proxyIPv6SupportMap()[getNowProxyNodeName(props.name || '')]
  })

  return (
    <Show when={support()}>
      <span class={`text-xs`}>IPv6</span>
    </Show>
  )
}
