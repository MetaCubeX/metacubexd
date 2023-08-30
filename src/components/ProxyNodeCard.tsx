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
  console.log(proxyName)

  return (
    <div
      class={twMerge(
        isSelected
          ? 'border-primary bg-success-content text-success'
          : 'border-secondary',
        onClick && 'cursor-pointer',
        'card card-bordered tooltip tooltip-bottom card-compact flex flex-row justify-between gap-2 p-4',
      )}
      onClick={() => onClick?.()}
      data-tip={proxyName}
    >
      <span class="truncate">{proxyName}</span>
      <span>{Delay(proxyName)}</span>
    </div>
  )
}
