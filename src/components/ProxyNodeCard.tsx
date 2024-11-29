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
import { rootElement, useProxies } from '~/signals'

export const ProxyNodeCard = (props: {
  proxyName: string
  testUrl: string | null
  timeout: number | null
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyName, isSelected, onClick } = props
  const {
    proxyNodeMap,
    proxyLatencyTest,
    proxyLatencyTestingMap,
    getLatencyHistoryByName,
  } = useProxies()
  const proxyNode = createMemo(() => proxyNodeMap()[proxyName])

  const specialTypes = createMemo(() => {
    if (!filterSpecialProxyType(proxyNode()?.type)) return null

    return `(${[
      proxyNode().xudp && 'xudp',
      proxyNode().udp && 'udp',
      proxyNode().tfo && 'TFO',
    ]
      .filter(Boolean)
      .join(' / ')})`
  })

  const title = createMemo(() =>
    [proxyName, specialTypes()].filter(Boolean).join(' - '),
  )

  const latencyTestHistory = getLatencyHistoryByName(
    props.proxyName,
    props.testUrl,
  )

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
          isSelected &&
            'bg-gradient-to-br from-primary to-secondary text-primary-content',
          onClick && 'cursor-pointer',
        )}
        title={title()}
      >
        <Tooltip.Trigger>
          <div class="card-body gap-1 space-y-1 p-2.5" onClick={onClick}>
            <h2 class="card-title line-clamp-1 break-all text-start text-sm">
              {proxyName}
            </h2>

            <div class="card-actions items-center justify-between gap-1">
              <div class="badge badge-secondary px-1 text-xs font-bold capitalize">
                {formatProxyType(proxyNode()?.type)}
              </div>

              <Latency
                proxyName={props.proxyName}
                testUrl={props.testUrl || null}
                class={twMerge(
                  proxyLatencyTestingMap()[proxyName] && 'animate-pulse',
                )}
                onClick={(e) => {
                  e.stopPropagation()

                  void proxyLatencyTest(
                    proxyName,
                    proxyNode().provider,
                    props.testUrl,
                    props.timeout,
                  )
                }}
              />
            </div>
          </div>
        </Tooltip.Trigger>

        <Tooltip.Portal mount={rootElement()}>
          <Tooltip.Content class="z-50">
            <Tooltip.Arrow class="text-neutral" />

            <div class="flex flex-col items-center gap-2 rounded-box bg-neutral bg-gradient-to-br from-primary to-secondary p-2.5 text-primary-content shadow-lg">
              <h2 class="text-lg font-bold">{proxyName}</h2>

              <div class="w-full text-xs uppercase">{specialTypes()}</div>

              <ul class="timeline timeline-vertical timeline-compact timeline-snap-icon">
                <For each={latencyTestHistory}>
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
                          {latencyTestResult.delay || '---'}
                        </div>
                      </div>

                      <div class="timeline-middle">
                        <IconCircleCheckFilled class="size-4" />
                      </div>

                      <Show when={index() !== latencyTestHistory.length - 1}>
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
