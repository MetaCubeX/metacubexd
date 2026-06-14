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
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-base-content/15">
        <div
          class="h-full rounded-full transition-[width] duration-500 ease-out"
          :style="{
            width: `${percentage}%`,
            background:
              'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
          }"
        />
      </div>
      <div
        class="flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-content"
      >
        {{ percentage }}%
      </div>
    </div>

    <div class="mt-1.5 flex flex-wrap items-center justify-between gap-2">
      <div class="text-sm text-base-content/60">{{ used }} / {{ total }}</div>
      <div class="text-sm text-base-content/60">
        {{ t('expire') }}: {{ expireStr }}
      </div>
    </div>
  </template>
</template>
