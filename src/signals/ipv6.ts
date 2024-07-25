import { proxyGroupLatencyTestAPI, proxyLatencyTestAPI } from '~/apis'
import {
  latencyQualityMap,
  latencyTestTimeoutDuration,
  urlForIPv6SupportTest,
} from './config'

export const [proxyIPv6SupportMap, setProxyIPv6SupportMap] = createSignal<
  Record<string, boolean>
>({})

export const proxyIPv6SupportTest = async (
  proxyName: string,
  provider: string,
) => {
  const urlForTest = urlForIPv6SupportTest()

  if (!urlForTest || urlForTest.length === 0) {
    setProxyIPv6SupportMap({})

    return
  }

  let support = false
  try {
    const { delay } = await proxyLatencyTestAPI(
      proxyName,
      provider,
      urlForTest,
      latencyTestTimeoutDuration(),
    )
    support = delay > latencyQualityMap().NOT_CONNECTED
  } catch {
    support = false
  }
  setProxyIPv6SupportMap((supportMap) => ({
    ...supportMap,
    [proxyName]: support,
  }))
}

export const proxyGroupIPv6SupportTest = async (proxyGroupName: string) => {
  const urlForTest = urlForIPv6SupportTest()

  if (!urlForTest || urlForTest.length === 0) {
    setProxyIPv6SupportMap({})

    return
  }

  const newLatencyMap = await proxyGroupLatencyTestAPI(
    proxyGroupName,
    urlForTest,
    latencyTestTimeoutDuration(),
  )
  const newSupportMap = Object.fromEntries(
    Object.entries(newLatencyMap).map(([k, v]) => [
      k,
      v > latencyQualityMap().NOT_CONNECTED,
    ]),
  )
  setProxyIPv6SupportMap((supportMap) => ({
    ...supportMap,
    ...newSupportMap,
  }))
}
