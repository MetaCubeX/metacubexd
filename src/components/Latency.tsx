import { JSX, ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { getLatencyClassName } from '~/helpers'
import { useProxies } from '~/signals'

interface Props extends JSX.HTMLAttributes<HTMLSpanElement> {
  proxyName: string
}

export const Latency: ParentComponent<Props> = (props) => {
  const [local, others] = splitProps(props, ['class'])
  const { getLatencyByName } = useProxies()
  const [textClassName, setTextClassName] = createSignal('')
  const latency = createMemo(() => getLatencyByName(others.proxyName || ''))

  createEffect(() => {
    setTextClassName(getLatencyClassName(latency()))
  })

  return (
    <span
      class={twMerge('badge w-11 whitespace-nowrap', textClassName(), local.class)}
      {...others}
    >
      {latency() || '---'}
    </span>
  )
}
