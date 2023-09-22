import dayjs from 'dayjs'
import { curLocale } from '~/i18n'

export const formatTimeFromNow = (time: number | string) =>
  dayjs(time).locale(curLocale()).fromNow()
