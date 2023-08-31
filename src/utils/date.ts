import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function formatTimeFromNow(time: number | string) {
  return dayjs(time).fromNow()
}
