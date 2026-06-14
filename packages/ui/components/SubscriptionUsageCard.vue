<!-- packages/ui/components/SubscriptionUsageCard.vue -->
<script setup lang="ts">
import type { SubscriptionInfo as ClashSubscriptionInfo } from '~/types'
import type { ProfileSubscriptionInfo } from '~/types/control'

const props = defineProps<{ info?: ProfileSubscriptionInfo }>()

// Map agent's lowercase subscriptionInfo -> existing SubscriptionInfo (PascalCase).
const mapped = computed<ClashSubscriptionInfo | undefined>(() => {
  if (!props.info) return undefined
  return {
    Upload: props.info.upload,
    Download: props.info.download,
    Total: props.info.total,
    Expire: props.info.expire,
  }
})
</script>

<template>
  <SubscriptionInfo v-if="mapped" :subscription-info="mapped" />
</template>
