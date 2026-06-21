import type { MaybeRefOrGetter } from 'vue'
import type { Proxy } from '~/types'
import {
  filterSpecialProxyType,
  formatProxyType,
  getLatencyClassName,
} from '~/utils'

export interface UseProxyNodeOptions {
  providerName?: MaybeRefOrGetter<string>
  groupName?: MaybeRefOrGetter<string>
}

// The proxy-node read model: the presentation folds the four ProxyNode*
// variants share, derived through the store's honest queries. UI-framework-free
// (no .vue), so it unit-tests as a plain call against a seeded store.
export function useProxyNode(
  proxyName: MaybeRefOrGetter<string>,
  testUrl: MaybeRefOrGetter<string | null>,
  timeout: MaybeRefOrGetter<number | null>,
  options: UseProxyNodeOptions = {},
) {
  const proxiesStore = useProxiesStore()
  const configStore = useConfigStore()
  const { t } = useI18n()

  const node = computed(() => proxiesStore.getNode(toValue(proxyName)))

  const proxyType = computed(() => formatProxyType(node.value?.type ?? '', t))
  const isUDP = computed(() => !!(node.value?.xudp || node.value?.udp))

  // Bare joined string (no parens) — templates add their own parens.
  const specialTypes = computed(() => {
    if (!filterSpecialProxyType(node.value?.type)) return null
    return [
      node.value?.xudp && 'xudp',
      node.value?.udp && 'udp',
      node.value?.tfo && 'TFO',
    ]
      .filter(Boolean)
      .join(' / ')
  })

  const latency = computed(() =>
    proxiesStore.getLatencyByName(toValue(proxyName), toValue(testUrl)),
  )

  const latencyColorClass = computed(() =>
    latency.value
      ? getLatencyClassName(latency.value, configStore.latencyQualityMap)
      : 'text-neutral-content/30',
  )

  const stabilityBar = computed(() =>
    proxiesStore
      .getLatencyHistoryByName(toValue(proxyName), toValue(testUrl))
      .map((result) => ({
        colorClass: result.delay
          ? getLatencyClassName(result.delay, configStore.latencyQualityMap)
          : 'text-neutral-content/30',
      })),
  )

  const historyReversed = computed<Proxy['history']>(() =>
    proxiesStore
      .getLatencyHistoryByName(toValue(proxyName), toValue(testUrl))
      .toReversed(),
  )

  const isTesting = computed(() =>
    proxiesStore.isTesting(toValue(proxyName), {
      providerName: options.providerName ? toValue(options.providerName) : '',
      groupName: options.groupName ? toValue(options.groupName) : '',
    }),
  )

  const runLatencyTest = () => {
    proxiesStore.proxyLatencyTest(
      toValue(proxyName),
      node.value?.provider ?? '',
      toValue(testUrl),
      toValue(timeout),
    )
  }

  return {
    node,
    proxyType,
    isUDP,
    specialTypes,
    latency,
    latencyColorClass,
    stabilityBar,
    historyReversed,
    isTesting,
    runLatencyTest,
  }
}
