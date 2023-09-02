import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export const formatTimeFromNow = (time: number | string) => {
  return dayjs(time).fromNow()
}

export const getBtnElFromClickEvent = (event: MouseEvent) => {
  let el = event.target as HTMLElement

  while (el && !el.classList.contains('btn')) {
    el = el.parentElement!
  }

  return el
}
