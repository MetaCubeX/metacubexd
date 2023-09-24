import { IconBrandSpeedtest } from '@tabler/icons-solidjs'
import { createMemo, Show } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button, Latency } from '~/components'
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
        'card card-bordered tooltip-bottom card-compact flex gap-1 border-neutral-focus bg-neutral p-3 text-neutral-content shadow-lg sm:tooltip',
        isSelected && 'border-primary bg-primary-content text-primary',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
      data-tip={proxyName}
    >
      <div class="flex items-center justify-between gap-2">
        <span class="truncate text-left">{proxyName}</span>

        <Button
          class="btn-circle btn-ghost btn-sm"
          icon={
            <IconBrandSpeedtest
              class={twMerge(
                proxyLatencyTestingMap()[proxyName] &&
                  'animate-pulse text-success',
              )}
            />
          }
          onClick={(e) => {
            e.stopPropagation()

            void proxyLatencyTest(proxyName)
          }}
        />
      </div>

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
