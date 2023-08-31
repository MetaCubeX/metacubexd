import { createMemo } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { useProxies } from '~/signals/proxies'

export default (props: {
  proxyName: string
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyName, isSelected, onClick } = props
  const { delayMap, proxyNodeMap } = useProxies()
  const proxyNode = createMemo(() => proxyNodeMap()[proxyName])

  const Delay = (proxyname: string) => {
    const delay = delayMap()[proxyname]

    if (typeof delay !== 'number' || delay === 0) {
      return ''
    }

    let textClassName = 'text-green-500'

    if (delay > 500) {
      textClassName = 'text-red-500'
    } else if (delay > 200) {
      textClassName = 'text-yellow-500'
    }

    return <span class={textClassName}>{delay}ms</span>
  }

  const formatProxyType = (type: string) => {
    const t = type.toLowerCase()

    if (t.includes('shadowsocks')) {
      return t.replace('shadowsocks', 'ss')
    }

    return t
  }

  return (
    <div
      class={twMerge(
        'card card-bordered tooltip tooltip-bottom card-compact flex gap-1 border-primary p-3',
        isSelected && 'border-success bg-success-content text-success',
        onClick && 'cursor-pointer',
      )}
      onClick={() => onClick?.()}
      data-tip={proxyName}
    >
      <div class="truncate text-left">{proxyName}</div>
      <div class="flex items-center justify-between gap-1">
        <div class="truncate text-xs text-slate-500">
          {formatProxyType(proxyNode().type)}
          {proxyNode().udp && ' :: udp'}
        </div>
        <div class="text-xs">{Delay(proxyName)}</div>
      </div>
    </div>
  )
}
