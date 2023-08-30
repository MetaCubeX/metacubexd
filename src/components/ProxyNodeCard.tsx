import { twMerge } from 'tailwind-merge'
import { useProxies } from '~/signals/proxies'

export default (props: {
  proxyName: string
  isSelected?: boolean
  onClick?: () => void
}) => {
  const { proxyName, isSelected, onClick } = props
  const { delayMap } = useProxies()
  const Delay = (proxyname: string) => {
    const delay = delayMap()[proxyname]

    if (typeof delay !== 'number' || delay === 0) {
      return ''
    }

    return <span>{delay}ms</span>
  }

  return (
    <div
      class={twMerge(
        isSelected
          ? 'border-primary bg-success-content text-success'
          : 'border-secondary',
        onClick ? 'cursor-pointer' : '',
        'card card-bordered card-compact m-1 flex-row justify-between border-secondary p-4',
      )}
      onClick={() => onClick?.()}
    >
      <span class="mr-2 overflow-hidden whitespace-nowrap">{proxyName}</span>
      <span>{Delay(proxyName)}</span>
    </div>
  )
}
