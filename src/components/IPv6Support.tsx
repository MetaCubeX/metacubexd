import { useProxies } from '~/signals'

export const IPv6Support = (props: { name?: string }) => {
  const { getNowProxyNodeName, proxyIPv6SupportMap } = useProxies()

  const support = createMemo(() => {
    return proxyIPv6SupportMap()[getNowProxyNodeName(props.name || '')]
  })

  return (
    <Show when={support()}>
      <span class={`text-xs`}>IPv6</span>
    </Show>
  )
}
