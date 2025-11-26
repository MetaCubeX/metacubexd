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
import { useI18n } from '~/i18n'
import { rootElement, useProxies } from '~/signals'

export const ProxyNodeListItem = (props: {
  proxyName: string
  testUrl: string | null
  timeout: number | null
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyName, isSelected, onClick } = props
  const [t] = useI18n()
  const {
    proxyNodeMap,
    proxyLatencyTest,
    proxyLatencyTestingMap,
    getLatencyHistoryByName,
  } = useProxies()
  const proxyNode = createMemo(() => proxyNodeMap()[proxyName])

  const specialTypes = createMemo(() => {
    if (!filterSpecialProxyType(proxyNode()?.type)) return null

    return [
      proxyNode().xudp && 'xudp',
      proxyNode().udp && 'udp',
      proxyNode().tfo && 'TFO',
    ]
      .filter(Boolean)
      .join(' / ')
  })

  const isUDP = createMemo(() => proxyNode().xudp || proxyNode().udp)

  const latencyTestHistory = getLatencyHistoryByName(
    props.proxyName,
    props.testUrl,
  ).toReversed()

  return (
    <Tooltip
      placement="top"
      group="proxy-node"
      openDelay={300}
      floatingOptions={{
        flip: true,
        shift: { padding: 8 },
        offset: 8,
        arrow: 8,
        size: { fitViewPort: true },
      }}
    >
      <Tooltip.Anchor
        as="div"
        class={twMerge(
          'rounded-lg bg-neutral text-neutral-content',
          isSelected && 'bg-primary text-primary-content',
        )}
      >
        <Tooltip.Trigger as="div">
          <div
            class={twMerge(
              'flex items-center gap-2 px-3 py-1.5',
              onClick && 'cursor-pointer hover:opacity-80',
            )}
            onClick={onClick}
          >
            {/* Selected indicator */}
            <Show when={isSelected}>
              <IconCircleCheckFilled class="size-4 shrink-0" />
            </Show>

            {/* Proxy name */}
            <span class="min-w-0 flex-1 truncate text-sm font-medium">
              {proxyName}
            </span>

            {/* UDP indicator */}
            <Show when={isUDP()}>
              <span class="badge shrink-0 badge-xs badge-info">U</span>
            </Show>

            {/* Special types */}
            <Show when={specialTypes()}>
              <span class="hidden text-xs uppercase opacity-60 sm:inline">
                {specialTypes()}
              </span>
            </Show>

            {/* Proxy type */}
            <span class="hidden text-xs uppercase opacity-75 sm:inline">
              {formatProxyType(proxyNode()?.type)}
            </span>

            {/* Latency */}
            <Latency
              proxyName={props.proxyName}
              testUrl={props.testUrl || null}
              class={twMerge(
                'shrink-0',
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
        </Tooltip.Trigger>

        <Tooltip.Portal mount={rootElement()}>
          <Tooltip.Content class="z-50">
            <Tooltip.Arrow class="text-primary [&>svg]:-translate-y-px [&>svg]:fill-current" />

            <div class="flex max-h-[70vh] flex-col items-center gap-2 overflow-y-auto rounded-box bg-primary p-2.5 text-primary-content shadow-lg [clip-path:inset(0_round_var(--radius-box))]">
              <h2 class="text-lg font-bold">{proxyName}</h2>

              <Show when={specialTypes()}>
                <div class="w-full text-xs uppercase">{specialTypes()}</div>
              </Show>

              <Show
                when={latencyTestHistory.length > 0}
                fallback={
                  <div class="text-sm opacity-75">{t('noLatencyHistory')}</div>
                }
              >
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
              </Show>
            </div>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Anchor>
    </Tooltip>
  )
}
