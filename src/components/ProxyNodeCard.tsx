import { createMemo } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import Delay from '~/components/Delay'
import { useProxies } from '~/signals/proxies'

export default (props: {
  proxyName: string
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyName, isSelected, onClick } = props
  const { proxyNodeMap } = useProxies()
  const proxyNode = createMemo(() => proxyNodeMap()[proxyName])

  const formatProxyType = (type = '') => {
    const t = type.toLowerCase()

    if (t.includes('shadowsocks')) {
      return t.replace('shadowsocks', 'ss')
    }

    return t
  }

  return (
    <div
      class={twMerge(
        'card card-bordered tooltip-bottom card-compact flex gap-1 border-neutral-focus bg-neutral p-3 text-neutral-content sm:tooltip',
        isSelected && 'border-primary bg-primary-content text-primary',
        onClick && 'cursor-pointer',
      )}
      onClick={() => onClick?.()}
      data-tip={proxyName}
    >
      <div class="truncate text-left">{proxyName}</div>
      <div class="flex items-center justify-between gap-1">
        <div
          class={twMerge(
            'truncate text-xs text-slate-500',
            isSelected && 'text-primary',
          )}
        >
          {formatProxyType(proxyNode()?.type)}
          {proxyNode()?.udp && ' :: udp'}
        </div>
        <div class="text-xs">
          <Delay name={props.proxyName} />
        </div>
      </div>
    </div>
  )
}
