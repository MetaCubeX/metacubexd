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
        'card tooltip card-compact tooltip-accent bg-neutral text-neutral-content',
        isSelected &&
          'bg-gradient-to-l from-primary to-secondary text-primary-content',
        onClick && 'cursor-pointer',
      )}
      data-tip={proxyName}
      onClick={onClick}
    >
      <div class="card-body">
        <span class="card-title line-clamp-1 text-start text-sm">
          {proxyName}
        </span>

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="badge badge-primary badge-sm font-bold uppercase">
              {formatProxyType(proxyNode()?.type)}
            </div>

            <Show when={specialType()}>
              <div class="badge badge-secondary badge-sm">{specialType()}</div>
            </Show>

            <Show when={supportIPv6()}>
              <div class="badge badge-accent badge-sm">IPv6</div>
            </Show>
          </div>

          <div class="flex items-center gap-2">
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
    </div>
  )
}
