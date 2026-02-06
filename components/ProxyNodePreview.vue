<script setup lang="ts">
import { PROXIES_PREVIEW_TYPE } from '~/constants'

interface Props {
  proxyNameList: string[]
  testUrl: string | null
  now?: string
  onSelect?: (name: string) => void
}

const props = defineProps<Props>()

const configStore = useConfigStore()

const isOff = computed(
  () => configStore.proxiesPreviewType === PROXIES_PREVIEW_TYPE.OFF,
)

const isSmallGroup = computed(
  () => props.proxyNameList.length <= configStore.proxiesPreviewAutoThreshold,
)

const isShowBar = computed(() => {
  const type = configStore.proxiesPreviewType
  return (
    type === PROXIES_PREVIEW_TYPE.BAR ||
    (type === PROXIES_PREVIEW_TYPE.Auto && !isSmallGroup.value)
  )
})

const isShowDots = computed(() => {
  const type = configStore.proxiesPreviewType
  return (
    type === PROXIES_PREVIEW_TYPE.DOTS ||
    (type === PROXIES_PREVIEW_TYPE.Auto && isSmallGroup.value)
  )
})
</script>

<template>
  <template v-if="!isOff">
    <ProxyPreviewBar
      v-if="isShowBar"
      :proxy-name-list="proxyNameList"
      :test-url="testUrl"
      :now="now"
    />
    <ProxyPreviewDots
      v-else-if="isShowDots"
      :proxy-name-list="proxyNameList"
      :test-url="testUrl"
      :now="now"
      :on-select="onSelect"
    />
  </template>
</template>
