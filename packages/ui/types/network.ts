// IP Information types from various providers
export interface IPSBResponse {
  ip: string
  country?: string
  city?: string
  asn?: number
  asn_organization?: string
}

export interface IPWhoIsResponse {
  ip: string
  success: boolean
  type: string
  continent: string
  continent_code: string
  country: string
  country_code: string
  region: string
  region_code: string
  city: string
  latitude: number
  longitude: number
  is_eu: boolean
  postal: string
  calling_code: string
  capital: string
  borders: string
  flag: {
    img: string
    emoji: string
    emoji_unicode: string
  }
  connection: {
    asn: number
    org: string
    isp: string
    domain: string
  }
  timezone: {
    id: string
    abbr: string
    is_dst: boolean
    offset: number
    utc: string
    current_time: string
  }
}

export interface IPAPIResponse {
  ip: string
  rir: string
  is_bogon: boolean
  is_mobile: boolean
  is_crawler: boolean
  is_datacenter: boolean
  is_tor: boolean
  is_proxy: boolean
  is_vpn: boolean
  is_abuser: boolean
  company?: {
    name: string
    abuser_score: string
    domain: string
    type: string
    network: string
    whois: string
  }
  asn?: {
    asn: number
    abuser_score: string
    route: string
    descr: string
    country: string
    active: boolean
    org: string
    domain: string
    abuse: string
    type: string
    updated: string
    rir: string
    whois: string
  }
  location?: {
    continent: string
    country: string
    country_code: string
    state: string
    city: string
    latitude: number
    longitude: number
    zip: string
    timezone: string
    local_time: string
    local_time_unix: number
    is_dst: boolean
  }
}

// Unified IP info structure
export interface IPInfo {
  ip: string
  country?: string
  countryCode?: string
  city?: string
  region?: string
  asn?: number
  org?: string
  isp?: string
  isProxy?: boolean
  isVPN?: boolean
  latitude?: number
  longitude?: number
  timezone?: string
}

// IP Provider type
export type IPProvider = 'ip.sb' | 'ipwho.is' | 'ipapi.is'

// Network latency result
export interface LatencyResult {
  url: string
  latency: number | null
  status: 'success' | 'error' | 'pending'
  timestamp: number
}

// Network topology node
export interface TopologyNode {
  id: string
  name: string
  type: 'client' | 'proxy' | 'rule' | 'destination'
  x?: number
  y?: number
}

// Network topology edge
export interface TopologyEdge {
  source: string
  target: string
  traffic?: number
  connections?: number
}
