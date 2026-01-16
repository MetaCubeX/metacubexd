import type { CONNECTIONS_TABLE_ACCESSOR_KEY, LOG_LEVEL } from '~/constants'

export interface Proxy {
  name: string
  type: string
  all?: string[]
  icon?: string
  extra: Record<string, unknown>
  history: {
    time: string
    delay: number
  }[]
  hidden: boolean
  udp: boolean
  xudp: boolean
  tfo: boolean
  now: string
  testUrl?: string
  timeout?: number
}

export interface ProxyNode {
  alive: boolean
  type: string
  name: string
  tfo: boolean
  udp: boolean
  xudp: boolean
  now: string
  id: string
  extra: Record<string, unknown>
  history: {
    time: string
    delay: number
  }[]
}

export interface SubscriptionInfo {
  Download?: number
  Upload?: number
  Total?: number
  Expire?: number
}

export interface ProxyProvider {
  subscriptionInfo?: SubscriptionInfo
  name: string
  proxies: ProxyNode[]
  testUrl: string
  timeout?: number
  updatedAt: string
  vehicleType: string
}

export interface Rule {
  type: string
  payload: string
  proxy: string
  size: number
}

export interface RuleProvider {
  behavior: string
  format: string
  name: string
  ruleCount: number
  type: string
  updatedAt: string
  vehicleType: string
}

export interface ConnectionRawMessage {
  id: string
  download: number
  upload: number
  chains: string[]
  rule: string
  rulePayload: string
  start: string
  metadata: {
    network: string
    type: string
    destinationIP: string
    destinationPort: string
    dnsMode: string
    host: string
    inboundIP: string
    inboundName: string
    inboundPort: string
    inboundUser: string
    process: string
    processPath: string
    remoteDestination: string
    sniffHost: string
    sourceIP: string
    sourcePort: string
    specialProxy: string
    specialRules: string
    uid: number
  }
}

export type Connection = ConnectionRawMessage & {
  downloadSpeed: number
  uploadSpeed: number
}

export interface Log {
  type: LOG_LEVEL
  payload: string
}

export type LogWithSeq = Log & { seq: number }

export interface Config {
  mode: string
  // sing-box added
  'mode-list': string[]
  // sing-box-p added
  modes?: string[]
  port: number
  'socks-port': number
  'redir-port': number
  'tproxy-port': number
  'mixed-port': number
  tun: {
    enable: boolean
    device: string
    stack: string
    'dns-hijack': null
    'auto-route': boolean
    'auto-detect-interface': boolean
    'file-descriptor': number
  }
  'tuic-server': {
    enable: boolean
    listen: string
    certificate: string
    'private-key': string
  }
  'ss-config': string
  'vmess-config': string
  authentication: null
  'allow-lan': boolean
  'bind-address': string
  'inbound-tfo': boolean
  UnifiedDelay: boolean
  'log-level': string
  ipv6: boolean
  'interface-name': string
  'geodata-mode': boolean
  'geodata-loader': string
  'tcp-concurrent': boolean
  'find-process-mode': string
  sniffing: boolean
  'global-client-fingerprint': boolean
}

export interface DNSQuery {
  AD: boolean
  CD: boolean
  RA: boolean
  RD: boolean
  TC: boolean
  status: number
  Question: {
    Name: string
    Qtype: number
    Qclass: number
  }[]
  Answer?: {
    TTL: number
    data: string
    name: string
    type: number
  }[]
}

export interface BackendVersion {
  meta: boolean
  version: string
}

export type ConnectionsTableColumnVisibility = Partial<
  Record<CONNECTIONS_TABLE_ACCESSOR_KEY, boolean>
>
export type ConnectionsTableColumnOrder = CONNECTIONS_TABLE_ACCESSOR_KEY[]

export type DataUsageType = 'sourceIP' | 'host' | 'process' | 'outbound'

export interface DataUsageEntry {
  type: DataUsageType
  label: string
  upload: number
  download: number
  total: number
  firstSeen: number
  lastSeen: number
}

export interface TrafficData {
  up: number
  down: number
}

export interface MemoryData {
  inuse: number
}

export type WsMsg = {
  connections?: ConnectionRawMessage[]
  uploadTotal: number
  downloadTotal: number
} | null

export type ChartDataPoint = [number, number]

export interface Endpoint {
  id: string
  url: string
  secret: string
}

export type ProxyWithProvider = Proxy & { provider?: string }
export type ProxyNodeWithProvider = ProxyNode & { provider?: string }

export interface ReleaseInfo {
  version: string
  changelog: string
  publishedAt: string
  isCurrent: boolean
}
