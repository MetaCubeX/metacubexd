import { CONNECTIONS_TABLE_ACCESSOR_KEY, LOG_LEVEL } from '~/constants'

declare module 'solid-js' {
  namespace JSX {
    interface Directives {
      [name: string]: unknown
    }
  }
}

export type Proxy = {
  name: string
  type: string
  all?: string[]
  extra: Record<string, unknown>
  history: {
    time: string
    delay: number
  }[]
  udp: boolean
  xudp: boolean
  tfo: boolean
  now: string
}

export type ProxyNode = {
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

export type SubscriptionInfo = {
  Download?: number
  Upload?: number
  Total?: number
  Expire?: number
}

export type ProxyProvider = {
  subscriptionInfo?: SubscriptionInfo
  name: string
  proxies: ProxyNode[]
  testUrl: string
  updatedAt: string
  vehicleType: string
}

export type Rule = {
  type: string
  payload: string
  proxy: string
  size: number
}

export type RuleProvider = {
  behavior: string
  format: string
  name: string
  ruleCount: number
  type: string
  updatedAt: string
  vehicleType: string
}

export type ConnectionRawMessage = {
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

export type Log = {
  type: LOG_LEVEL
  payload: string
}

export type LogWithSeq = Log & { seq: number }

export type Config = {
  mode: 'global' | 'rule' | 'direct'
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

export type DNSQuery = {
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

export type BackendVersion = {
  meta: boolean
  version: string
}

export type ConnectionsTableColumnVisibility = Partial<
  Record<CONNECTIONS_TABLE_ACCESSOR_KEY, boolean>
>
export type ConnectionsTableColumnOrder = CONNECTIONS_TABLE_ACCESSOR_KEY[]
