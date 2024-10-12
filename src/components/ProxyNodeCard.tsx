import Tooltip from '@corvu/tooltip'
import { IconCircleCheckFilled } from '@tabler/icons-solidjs'
import dayjs from 'dayjs'
import { twMerge } from 'tailwind-merge'
import { Latency } from '~/components'
import {
  filterSpecialProxyType,
  formatProxyType,
  getLatencyClassName,
} from '~/helpers'
import { curTheme, useProxies } from '~/signals'

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
    <Tooltip
      placement="top"
      floatingOptions={{
        autoPlacement: true,
        shift: true,
        offset: 10,
      }}
    >
      <Tooltip.Anchor
        class={twMerge(
          'card bg-neutral text-neutral-content',
          isSelected && 'bg-primary text-primary-content',
          onClick && 'cursor-pointer',
        )}
        title={proxyName}
      >
        <Tooltip.Trigger>
          <div class="card-body p-2.5" onClick={onClick}>
            <h2 class="card-title line-clamp-1 text-start text-sm">
              {proxyName}
            </h2>

            <span
              class={twMerge(
                'text-start text-xs',
                isSelected ? 'text-info-content' : 'text-neutral-content',
              )}
            >
              {[
                specialType(),
                supportIPv6() && 'IPv6',
                proxyNode().tfo && 'TFO',
              ]
                .filter(Boolean)
                .join(' / ')}
            </span>

            <div class="card-actions items-center justify-between">
              <div class="badge badge-secondary badge-sm font-bold uppercase">
                {formatProxyType(proxyNode()?.type)}
              </div>

              <Latency
                proxyName={props.proxyName}
                class={twMerge(
                  proxyLatencyTestingMap()[proxyName] && 'animate-pulse',
                )}
                onClick={(e) => {
                  e.stopPropagation()

                  void proxyLatencyTest(proxyName, proxyNode().provider)
                }}
              />
            </div>
          </div>
        </Tooltip.Trigger>

        <Tooltip.Portal>
          <Tooltip.Content data-theme={curTheme()} class="z-50 bg-transparent">
            <Tooltip.Arrow class="text-neutral" />

            <div class="flex flex-col items-center gap-2 rounded-box bg-neutral p-2.5 text-neutral-content">
              <h2 class="text-lg font-bold">{proxyName}</h2>

              <ul class="timeline timeline-vertical timeline-compact timeline-snap-icon">
                <For each={proxyNode().latencyTestHistory}>
                  {(latencyTestResult, index) => (
                    <li>
                      <Show when={index() > 0}>
                        <hr />
                      </Show>

                      <div class="timeline-start space-y-2">
                        <time class="text-sm italic">
                          {dayjs(latencyTestResult.time).format(
                            'YYYY-MM-DD HH:mm:ss',
                          )}
                        </time>

                        <div
                          class={twMerge(
                            'badge block',
                            getLatencyClassName(latencyTestResult.delay),
                          )}
                        >
                          {latencyTestResult.delay || '-'}
                        </div>
                      </div>

                      <div class="timeline-middle">
                        <IconCircleCheckFilled class="size-4" />
                      </div>

                      <Show
                        when={
                          index() !== proxyNode().latencyTestHistory.length - 1
                        }
                      >
                        <hr />
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Anchor>
    </Tooltip>
  )
}
