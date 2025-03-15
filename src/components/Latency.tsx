import { JSX, ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { getLatencyClassName } from '~/helpers'
import { urlForLatencyTest, useProxies } from '~/signals'

interface Props extends JSX.HTMLAttributes<HTMLSpanElement> {
  proxyName: string
  testUrl: string | null
}

export const Latency: ParentComponent<Props> = (props) => {
  const [local, others] = splitProps(props, ['class'])
  const { getLatencyByName, proxyLatencyTestingMap } = useProxies()
  const updating = createMemo(() => proxyLatencyTestingMap()[others.proxyName])
  const [textClassName, setTextClassName] = createSignal('')
  const latency = createMemo(() =>
    getLatencyByName(
      others.proxyName || '',
      others.testUrl || urlForLatencyTest(),
    ),
  )

  createEffect(() => {
    setTextClassName(getLatencyClassName(latency()))
  })

  return (
    <span
      class={twMerge(
        'badge flex w-11 items-center justify-center whitespace-nowrap',
        textClassName(),
        local.class,
      )}
      {...others}
    >
      <Show when={updating()} fallback={latency() || '---'}>
        <span class="loading loading-sm loading-infinity" />
      </Show>
    </span>
  )
}
