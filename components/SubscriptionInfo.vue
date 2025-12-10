<script setup lang="ts">
import type { SubscriptionInfo } from '~/types'
import byteSize from 'byte-size'
import dayjs from 'dayjs'

interface Props {
  subscriptionInfo?: SubscriptionInfo
}

const props = defineProps<Props>()
const { t } = useI18n()

const total = computed(() => {
  if (!props.subscriptionInfo) return '0 B'
  return byteSize(props.subscriptionInfo.Total || 0, {
    units: 'iec',
  }).toString()
})

const used = computed(() => {
  if (!props.subscriptionInfo) return '0 B'
  const { Download = 0, Upload = 0 } = props.subscriptionInfo
  return byteSize(Download + Upload, { units: 'iec' }).toString()
})

const percentage = computed(() => {
  if (!props.subscriptionInfo?.Total) return 0
  const { Download = 0, Upload = 0, Total = 1 } = props.subscriptionInfo
  return Math.min(Number((((Download + Upload) / Total) * 100).toFixed(1)), 999)
})

const expireStr = computed(() => {
  if (!props.subscriptionInfo?.Expire) return t('noExpire')
  return dayjs(props.subscriptionInfo.Expire * 1000).format('YYYY-MM-DD')
})
</script>

<template>
  <template v-if="subscriptionInfo">
    <div class="flex items-center gap-2 pt-1">
      <progress class="progress" :value="percentage" max="100" />
      <div class="badge badge-sm badge-secondary">{{ percentage }}%</div>
    </div>

    <div class="flex flex-wrap items-center justify-between">
      <div class="text-sm text-slate-500">{{ used }} / {{ total }}</div>

      <div class="text-sm text-slate-500">
        {{ t('expire') }}: {{ expireStr }}
      </div>
    </div>
  </template>
</template>
