import type {
  IPAPIResponse,
  IPInfo,
  IPProvider,
  IPSBResponse,
  IPWhoIsResponse,
} from '~/types/network'
import ky from 'ky'

// IP query endpoints
const IP_ENDPOINTS: Record<IPProvider, string> = {
  'ip.sb': 'https://api.ip.sb/geoip',
  'ipwho.is': 'https://ipwho.is/',
  'ipapi.is': 'https://api.ipapi.is/',
}

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

// Fetch IP information from a specific provider
export async function fetchIPInfo(provider: IPProvider): Promise<IPInfo> {
  const url = IP_ENDPOINTS[provider]
  const response = await ky.get(url, { timeout: 10000 }).json()

  switch (provider) {
    case 'ip.sb':
      return parseIPSBResponse(response as IPSBResponse)
    case 'ipwho.is':
      return parseIPWhoIsResponse(response as IPWhoIsResponse)
    case 'ipapi.is':
      return parseIPAPIResponse(response as IPAPIResponse)
    default:
      throw new Error(`Unknown IP provider: ${provider}`)
  }
}

// Composable for IP information
export function useIPInfo() {
  const currentProvider = ref<IPProvider>('ip.sb')
  const ipInfo = ref<IPInfo | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchIP(provider?: IPProvider) {
    const targetProvider = provider ?? currentProvider.value
    isLoading.value = true
    error.value = null

    try {
      ipInfo.value = await fetchIPInfo(targetProvider)
      currentProvider.value = targetProvider
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch IP info'
      ipInfo.value = null
    } finally {
      isLoading.value = false
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
