import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function formatTimeFromNow(time: number | string) {
  return dayjs(time).fromNow()
}

export function getClassNameByDelay(delay: number | undefined) {
  let name = 'green-500'

  if (typeof delay !== 'number' || delay === 0) {
    name = 'base-100'
  } else if (delay > 500) {
    name = 'red-500'
  } else if (delay > 200) {
    name = 'yellow-500'
  }

  return name
}
