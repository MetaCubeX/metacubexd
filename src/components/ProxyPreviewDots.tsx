import { twMerge } from 'tailwind-merge'
import { Latency } from '~/components'
import { latencyQualityMap, useProxies } from '~/signals'

const LatencyDot = (props: {
  name: string
  latency?: number
  selected: boolean
}) => {
  let dotClassName = props.selected
    ? 'bg-white border-4 border-green-600'
    : 'bg-green-600'

  if (
    typeof props.latency !== 'number' ||
    props.latency === latencyQualityMap().NOT_CONNECTED
  ) {
    dotClassName = props.selected
      ? 'bg-white border-4 border-neutral'
      : 'bg-neutral'
  } else if (props.latency > latencyQualityMap().HIGH) {
    dotClassName = props.selected
      ? 'bg-white border-4 border-red-500'
      : 'bg-red-500'
  } else if (props.latency > latencyQualityMap().MEDIUM) {
    dotClassName = props.selected
      ? 'bg-white border-4 border-yellow-500'
      : 'bg-yellow-500'
  }

  return (
    <div
      class={twMerge('h-4 w-4 rounded-full', dotClassName)}
      title={props.name}
    />
  )
}

export const ProxyPreviewDots = (props: {
  proxyNameList: string[]
  testUrl: string | null
  now?: string
}) => {
  const { getLatencyByName } = useProxies()

  return (
    <div class="flex items-center gap-2">
      <div class="flex flex-1 flex-wrap items-center gap-1">
        <For
          each={props.proxyNameList.map((name): [string, number] => [
            name,
            getLatencyByName(name, props.testUrl),
          ])}
        >
          {([name, latency]) => (
            <LatencyDot
              name={name}
              latency={latency}
              selected={props.now === name}
            />
          )}
        </For>
      </div>

      <Show when={props.now}>
        <Latency proxyName={props.now!} testUrl={props.testUrl} />
      </Show>
    </div>
  )
}
