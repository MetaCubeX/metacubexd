import { IconBrandSpeedtest } from '@tabler/icons-solidjs'
import { twMerge } from 'tailwind-merge'
import { Button, Latency } from '~/components'
import { filterSpecialProxyType, formatProxyType } from '~/helpers'
import { useProxies } from '~/signals'

export const ProxyNodeCard = (props: {
  proxyName: string
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyName, isSelected, onClick } = props
  const {
    getNowProxyNodeName,
    proxyIPv6SupportMap,
    proxyNodeMap,
    proxyLatencyTest,
    proxyLatencyTestingMap,
  } = useProxies()
  const supportIPv6 = createMemo(
    () => proxyIPv6SupportMap()[getNowProxyNodeName(proxyName || '')],
  )
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
        'card tooltip card-compact tooltip-accent relative bg-neutral text-neutral-content',
        isSelected && 'bg-primary text-primary-content',
        onClick && 'cursor-pointer',
      )}
      data-tip={proxyName}
      onClick={onClick}
    >
      <div class="badge badge-secondary badge-sm absolute bottom-0 left-1/2 -translate-x-1/2 font-bold uppercase">
        {formatProxyType(proxyNode()?.type)}
      </div>

      <div class="card-body">
        <h2 class="card-title line-clamp-1 text-start text-sm">{proxyName}</h2>

        <span
          class={twMerge(
            'text-start text-xs',
            isSelected ? 'text-info-content' : 'text-neutral-content',
          )}
        >
          {[specialType(), supportIPv6() && 'IPv6'].filter(Boolean).join(' / ')}
        </span>

        <div class="card-actions items-center justify-end">
          <Latency
            name={props.proxyName}
            class={twMerge(isSelected && 'badge')}
          />

          <Button
            class="btn-square btn-sm"
            icon={
              <IconBrandSpeedtest
                class={twMerge(
                  'size-6',
                  proxyLatencyTestingMap()[proxyName] &&
                    'animate-pulse text-success',
                )}
              />
            }
            onClick={(e) => {
              e.stopPropagation()

              void proxyLatencyTest(proxyName, proxyNode().provider)
            }}
          />
        </div>
      </div>
    </div>
  )
}
