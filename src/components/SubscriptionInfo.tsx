import byteSize from 'byte-size'
import dayjs from 'dayjs'
import type { SubscriptionInfo } from '~/types'

const getSubscriptionsInfo = (subscriptionInfo: SubscriptionInfo) => {
  const total = byteSize(subscriptionInfo.Total)
  const used = byteSize(subscriptionInfo.Download + subscriptionInfo.Upload)
  const percentage = (
    ((subscriptionInfo.Download + subscriptionInfo.Upload) /
      subscriptionInfo.Total) *
    100
  ).toFixed(2)
  const expireStr = () => {
    if (subscriptionInfo.Expire === 0) {
      return 'Null'
    }

    return dayjs(subscriptionInfo.Expire * 1000).format('YYYY-MM-DD')
  }

  return {
    total,
    used,
    percentage,
    expireStr,
  }
}

export default (props: { subscriptionInfo: SubscriptionInfo }) => {
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

      <div class="text-sm text-slate-500">Expire: {info.expireStr()} </div>
    </>
  )
}
