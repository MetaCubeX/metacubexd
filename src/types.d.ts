declare module 'solid-js' {
  namespace JSX {
    interface Directives {
      form: {}
      sortable: {}
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
  id: string
  extra: Record<string, unknown>
  history: {
    time: string
    delay: number
  }[]
}
export type SubscriptionInfo = {
  Download: number
  Upload: number
  Total: number
  Expire: number
}

export type ProxyProvider = {
  subscriptionInfo: SubscriptionInfo
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

export type Connection = {
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

export type Config = {
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
  mode: 'rule' | 'global'
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
