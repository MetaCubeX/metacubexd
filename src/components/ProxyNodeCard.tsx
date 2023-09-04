import { createMemo, Show } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Latency } from '~/components'
import { filterSpecialProxyType, formatProxyType } from '~/helpers'
import { useProxies } from '~/signals'

export const ProxyNodeCard = (props: {
  proxyName: string
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyName, isSelected, onClick } = props
  const { proxyNodeMap } = useProxies()
  const proxyNode = createMemo(() => proxyNodeMap()[proxyName])
  const specialType = () =>
    filterSpecialProxyType(proxyNode()?.type)
      ? proxyNode()?.xudp
        ? 'xudp'
        : proxyNode()?.udp
        ? 'udp'
        : null
      : null

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
          <Show when={specialType()}>{` :: ${specialType()}`}</Show>
        </div>
        <div class="text-xs">
          <Latency name={props.proxyName} />
        </div>
      </div>
    </div>
  )
}
