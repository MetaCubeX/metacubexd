import { createMemo } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { DELAY } from '~/config/enum'
import { useProxies } from '~/signals/proxies'

export default (props: {
  proxyName: string
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyName, isSelected, onClick } = props
  const { proxyNodeMap } = useProxies()
  const proxyNode = createMemo(() => proxyNodeMap()[proxyName])

  const Delay = (delay: number | undefined) => {
    if (typeof delay !== 'number' || delay === DELAY.NOT_CONNECTED) {
      return ''
    }

    let textClassName = 'text-success'

    if (delay > DELAY.HIGH) {
      textClassName = 'text-error'
    } else if (delay > DELAY.MEDIUM) {
      textClassName = 'text-warning'
    }

    return <span class={textClassName}>{delay}ms</span>
  }

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
        'card card-bordered tooltip tooltip-bottom card-compact flex gap-1 border-neutral-focus bg-neutral p-3 text-neutral-content',
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
        <div class="text-xs">{Delay(proxyNode()?.delay)}</div>
      </div>
    </div>
  )
}
