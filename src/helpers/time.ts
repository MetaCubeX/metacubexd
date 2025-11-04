import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { locale } from '~/i18n'

dayjs.extend(duration)

export const formatTimeFromNow = (time: number | string) =>
  dayjs(time).locale(locale()).fromNow()
export const formatDuration = (startTime: number, endTime: number) => {
  const diff = endTime - startTime
  const dur = dayjs.duration(diff)

  const days = Math.floor(dur.asDays())
  const hours = dur.hours()
  const minutes = dur.minutes()
  const seconds = dur.seconds()

  const parts = []

  if (days > 0) parts.push(`${days}d`)

  if (hours > 0) parts.push(`${hours}h`)

  if (minutes > 0) parts.push(`${minutes}m`)

  if (seconds > 0 && days === 0) parts.push(`${seconds}s`)

  return parts.length > 0 ? parts.join(' ') : '0s'
}

export const formatDateRange = (startTime: number, endTime: number) => {
  const start = dayjs(startTime)
  const end = dayjs(endTime)
  const locale_str = locale()

  if (start.isSame(end, 'day')) {
    return `${start.locale(locale_str).format('MMM D, YYYY HH:mm')} - ${end.locale(locale_str).format('HH:mm')}`
  }

  return `${start.locale(locale_str).format('MMM D, HH:mm')} - ${end.locale(locale_str).format('MMM D, HH:mm')}`
}
