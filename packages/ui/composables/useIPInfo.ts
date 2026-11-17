import type {
  IPAPIResponse,
  IPInfo,
  IPSBResponse,
  IPWhoIsResponse,
  VPNDetectionResponse,
} from '~/types/network'
import ky from 'ky'

export type CurrentIPProvider =
  'ip.sb' | 'ipwho.is' | 'ipapi.is' | 'ipinfo.io' | 'vpndetection.io'

// IP query endpoints
const IP_ENDPOINTS: Record<CurrentIPProvider, string> = {
  'ip.sb': 'https://api.ip.sb/geoip',
  'ipwho.is': 'https://ipwho.is/',
  'ipapi.is': 'https://api.ipapi.is/',
  'ipinfo.io': 'https://ipinfo.io/json',
  'vpndetection.io': 'https://api.vpndetection.io/myip',
}

const IP_PROVIDER_ORDER: CurrentIPProvider[] = [
  'ip.sb',
  'ipinfo.io',
  'ipwho.is',
  'ipapi.is',
  'vpndetection.io',
]

// Parse IP.SB response
function parseIPSBResponse(data: IPSBResponse): IPInfo {
  return {
    ip: data.ip,
    country: data.country,
    city: data.city,
    asn: data.asn,
    org: data.asn_organization,
  }
}

// Parse ipwho.is response
function parseIPWhoIsResponse(data: IPWhoIsResponse): IPInfo {
  return {
    ip: data.ip,
    country: data.country,
    countryCode: data.country_code,
    city: data.city,
    region: data.region,
    asn: data.connection?.asn,
    org: data.connection?.org,
    isp: data.connection?.isp,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone?.id,
  }
}

// Parse ipapi.is response
function parseIPAPIResponse(data: IPAPIResponse): IPInfo {
  return {
    ip: data.ip,
    country: data.location?.country,
    countryCode: data.location?.country_code,
    city: data.location?.city,
    region: data.location?.state,
    asn: data.asn?.asn,
    org: data.asn?.org,
    isProxy: data.is_proxy,
    isVPN: data.is_vpn,
    latitude: data.location?.latitude,
    longitude: data.location?.longitude,
    timezone: data.location?.timezone,
  }
}

function parseIPInfoResponse(data: {
  ip: string
  country?: string
  city?: string
  region?: string
  org?: string
}): IPInfo {
  return {
    ip: data.ip,
    country: data.country,
    countryCode: data.country,
    city: data.city,
    region: data.region,
    org: data.org,
  }
}

// Parse VPNDetection response; Tor exits and privacy relays count as proxies
function parseVPNDetectionResponse(data: VPNDetectionResponse): IPInfo {
  return {
    ip: data.ip,
    country: data.location?.country_name,
    countryCode: data.location?.country,
    asn: data.asn?.asn,
    org: data.asn?.name,
    isProxy: data.is_tor || data.is_relay,
    isVPN: data.is_vpn,
    timezone: data.location?.timezone,
  }
}

// Fetch IP information from a specific provider
export async function fetchIPInfo(
  provider: CurrentIPProvider,
): Promise<IPInfo> {
  const url = IP_ENDPOINTS[provider]
  const response = await ky
    .get(url, { timeout: 5000, cache: 'no-store' })
    .json()

  let info: IPInfo
  switch (provider) {
    case 'ip.sb':
      info = parseIPSBResponse(response as IPSBResponse)
      break
    case 'ipwho.is':
      info = parseIPWhoIsResponse(response as IPWhoIsResponse)
      break
    case 'ipapi.is':
      info = parseIPAPIResponse(response as IPAPIResponse)
      break
    case 'ipinfo.io':
      info = parseIPInfoResponse(
        response as {
          ip: string
          country?: string
          city?: string
          region?: string
          org?: string
        },
      )
      break
    case 'vpndetection.io':
      info = parseVPNDetectionResponse(response as VPNDetectionResponse)
      break
    default:
      throw new Error(`Unknown IP provider: ${provider}`)
  }

  if (typeof info.ip !== 'string' || !info.ip) {
    throw new Error(`Invalid IP response from ${provider}`)
  }
  return info
}

// Composable for IP information
export function useIPInfo() {
  const currentProvider = ref<CurrentIPProvider>('ip.sb')
  const ipInfo = ref<IPInfo | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let requestId = 0

  async function fetchIP(provider?: CurrentIPProvider) {
    const targetProvider = provider ?? currentProvider.value
    const currentRequest = ++requestId
    isLoading.value = true
    error.value = null

    try {
      for (const candidate of [
        targetProvider,
        ...IP_PROVIDER_ORDER.filter((item) => item !== targetProvider),
      ]) {
        if (currentRequest !== requestId) return
        try {
          const result = await fetchIPInfo(candidate)
          if (currentRequest !== requestId) return
          ipInfo.value = result
          currentProvider.value = candidate
          return
        } catch {
          // Try the next provider when this endpoint is unavailable.
        }
      }
      if (currentRequest !== requestId) return
      error.value = 'All IP information providers failed'
      ipInfo.value = null
    } finally {
      if (currentRequest === requestId) isLoading.value = false
    }
  }

  return {
    currentProvider,
    ipInfo,
    isLoading,
    error,
    fetchIP,
  }
}
