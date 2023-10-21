import { IconBrandSpeedtest } from '@tabler/icons-solidjs'
import { createMemo, Show } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button, IPv6Support, Latency } from '~/components'
import { filterSpecialProxyType, formatProxyType } from '~/helpers'
import { useProxies } from '~/signals'

export const ProxyNodeCard = (props: {
  proxyName: string
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyLatencyTest, proxyLatencyTestingMap } = useProxies()
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
        'card card-bordered tooltip-bottom flex flex-col justify-between gap-1 border-neutral-focus bg-neutral p-2 text-neutral-content',
        isSelected && 'border-primary bg-primary-content text-primary',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
      title={proxyName}
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-left text-sm">{proxyName}</span>

        <span class="flex items-center gap-1">
          <IPv6Support name={props.proxyName} />
          <Button
            class="btn-circle btn-ghost h-auto min-h-0 w-auto"
            icon={
              <IconBrandSpeedtest
                size={20}
                class={twMerge(
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
        </span>
      </div>

      <div class="flex items-center justify-between gap-1">
        <div
          class={twMerge(
            'text-xs text-slate-500',
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
