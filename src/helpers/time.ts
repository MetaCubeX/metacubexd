import dayjs, { locale } from 'dayjs'

export const formatTimeFromNow = (time: number | string) =>
  dayjs(time).locale(locale()).fromNow()
