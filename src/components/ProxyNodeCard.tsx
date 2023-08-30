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
    let textClassName = 'text-green-500'

    if (typeof delay !== 'number' || delay === 0) {
      return ''
    }

    if (delay > 500) {
      textClassName = 'text-red-500'
    } else if (delay > 200) {
      textClassName = 'text-yellow-500'
    }

    return <span class={textClassName}>{delay}ms</span>
  }

  return (
    <div
      class={twMerge(
        isSelected
          ? 'border-primary bg-success-content text-success'
          : 'border-secondary',
        onClick && 'cursor-pointer',
        'card card-bordered tooltip tooltip-bottom card-compact gap-2 p-4',
      )}
      onClick={() => onClick?.()}
      data-tip={proxyName}
    >
      <div class="flex truncate">{proxyName}</div>
      <div class="flex flex-row">
        <div class="flex flex-1 truncate">
          {proxyNode().type}
          {proxyNode().udp ? ' :: udp' : ''}
        </div>
        <div>{Delay(proxyName)}</div>
      </div>
    </div>
  )
}
