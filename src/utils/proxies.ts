import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function formatTimeFromNow(time: number | string) {
  return dayjs(time).fromNow()
}

export function getBtnElFromClickEvent(event: MouseEvent) {
  let el = event.target as HTMLElement

  while (el && !el.classList.contains('btn')) {
    el = el.parentElement!
  }

  return el
}
