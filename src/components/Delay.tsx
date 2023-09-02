import { DELAY } from '~/config/enum'

const Delay = (props: { delay: number | undefined }) => {
  const delay = props.delay

  if (typeof delay !== 'number' || delay === DELAY.NOT_CONNECTED) {
    return ''
  }

  let textClassName = 'text-success'

  if (delay > DELAY.HIGH) {
    textClassName = 'text-error'
  } else if (delay > DELAY.MEDIUM) {
    textClassName = 'text-warning'
  }

  return <span class={textClassName}>{delay}ms</span>
}

export default Delay
