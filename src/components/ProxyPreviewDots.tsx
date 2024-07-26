import { twMerge } from 'tailwind-merge'
import { Latency } from '~/components'
import { latencyQualityMap, useProxies } from '~/signals'

const LatencyDots = (props: {
  name: string
  latency?: number
  selected: boolean
}) => {
  let dotClassName = props.selected
    ? 'bg-white border-4 border-success'
    : 'bg-success'

  if (
    typeof props.latency !== 'number' ||
    props.latency === latencyQualityMap().NOT_CONNECTED
  ) {
    dotClassName = props.selected
      ? 'bg-white border-4 border-neutral'
      : 'bg-neutral'
  } else if (props.latency > latencyQualityMap().HIGH) {
    dotClassName = props.selected
      ? 'bg-white border-4 border-error'
      : 'bg-error'
  } else if (props.latency > latencyQualityMap().MEDIUM) {
    dotClassName = props.selected
      ? 'bg-white border-4 border-warning'
      : 'bg-warning'
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
  now?: string
}) => {
  const { getLatencyByName } = useProxies()

  return (
    <div class="flex items-center gap-2 py-2">
      <div class="flex flex-1 flex-wrap items-center gap-1">
        <For
          each={props.proxyNameList.map((name): [string, number] => [
            name,
            getLatencyByName(name),
          ])}
        >
          {([name, latency]) => {
            const isSelected = props.now === name

            return (
              <LatencyDots
                name={name}
                latency={latency}
                selected={isSelected}
              />
            )
          }}
        </For>
      </div>

      <Latency name={props.now} />
    </div>
  )
}
