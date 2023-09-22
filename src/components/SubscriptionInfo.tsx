import byteSize from 'byte-size'
import dayjs from 'dayjs'
import { toFinite } from 'lodash'
import { useI18n } from '~/i18n'
import type { SubscriptionInfo as ISubscriptionInfo } from '~/types'

const getSubscriptionsInfo = (subscriptionInfo: ISubscriptionInfo) => {
  const { Download = 0, Upload = 0, Total = 0, Expire = 0 } = subscriptionInfo

  const total = byteSize(Total, { units: 'iec' })
  const used = byteSize(Download + Upload, {
    units: 'iec',
  })
  const percentage = toFinite((((Download + Upload) / Total) * 100).toFixed(2))

  const expirePrefix = () => {
    const [t] = useI18n()

    return t('expire')
  }

  const expireStr = () => {
    const [t] = useI18n()

    if (Expire === 0) {
      return t('noExpire')
    }

    return dayjs(Expire * 1000).format('YYYY-MM-DD')
  }

  return {
    total,
    used,
    percentage,
    expirePrefix,
    expireStr,
  }
}

export const SubscriptionInfo = (props: {
  subscriptionInfo?: ISubscriptionInfo
}) => {
  if (!props.subscriptionInfo) {
    return
  }

  const info = getSubscriptionsInfo(props.subscriptionInfo)

  return (
    <>
      <progress class="progress" value={info.percentage} max="100" />

      <div class="text-sm text-slate-500">
        {`${info.used}`} / {`${info.total}`} ( {info.percentage}% )
      </div>

      <div class="text-sm text-slate-500">
        {info.expirePrefix()}: {info.expireStr()}
      </div>
    </>
  )
}
