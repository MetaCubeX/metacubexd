// Mock data for development and screenshot generation
import { LOG_LEVEL } from '~/constants'
import type {
  Config,
  Connection,
  Log,
  Proxy,
  ProxyProvider,
  Rule,
  RuleProvider,
} from '~/types'

// Mock proxy nodes for url-test groups
const createMockProxyNodes = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    name: `${prefix}-${i + 1}`,
    type: 'vmess',
    udp: true,
    xudp: true,
    tfo: false,
    now: '',
    history: [
      { time: new Date(Date.now() - 300000).toISOString(), delay: 80 + i * 10 },
      { time: new Date(Date.now() - 60000).toISOString(), delay: 75 + i * 8 },
      { time: new Date().toISOString(), delay: 70 + i * 5 },
    ],
    extra: {
      'https://www.gstatic.com/generate_204': {
        history: [
          {
            time: new Date(Date.now() - 300000).toISOString(),
            delay: 80 + i * 10,
          },
          {
            time: new Date(Date.now() - 60000).toISOString(),
            delay: 75 + i * 8,
          },
          { time: new Date().toISOString(), delay: 70 + i * 5 },
        ],
      },
    },
  }))

export const mockProxies: Proxy[] = [
  // Global group (Selector)
  {
    name: 'GLOBAL',
    type: 'Selector',
    all: ['Proxy', 'Auto', 'DIRECT', 'REJECT'],
    now: 'Proxy',
    udp: true,
    xudp: true,
    tfo: false,
    hidden: false,
    icon: '',
    extra: {},
    history: [],
  },
  // Main proxy selector
  {
    name: 'Proxy',
    type: 'Selector',
    all: ['Auto', 'HK-Auto', 'JP-Auto', 'US-Auto', 'SG-Auto', 'TW-Auto'],
    now: 'Auto',
    udp: true,
    xudp: true,
    tfo: false,
    hidden: false,
    icon: '',
    extra: {},
    history: [],
  },
  // Auto select group
  {
    name: 'Auto',
    type: 'URLTest',
    all: [
      'HK-1',
      'HK-2',
      'HK-3',
      'JP-1',
      'JP-2',
      'US-1',
      'US-2',
      'SG-1',
      'TW-1',
    ],
    now: 'HK-1',
    udp: true,
    xudp: true,
    tfo: false,
    hidden: false,
    icon: '',
    testUrl: 'https://www.gstatic.com/generate_204',
    extra: {},
    history: [
      { time: new Date(Date.now() - 60000).toISOString(), delay: 68 },
      { time: new Date().toISOString(), delay: 65 },
    ],
  },
  // Regional url-test groups
  {
    name: 'HK-Auto',
    type: 'URLTest',
    all: ['HK-1', 'HK-2', 'HK-3'],
    now: 'HK-1',
    udp: true,
    xudp: true,
    tfo: false,
    hidden: false,
    icon: '',
    testUrl: 'https://www.gstatic.com/generate_204',
    extra: {},
    history: [
      { time: new Date(Date.now() - 60000).toISOString(), delay: 72 },
      { time: new Date().toISOString(), delay: 68 },
    ],
  },
  {
    name: 'JP-Auto',
    type: 'URLTest',
    all: ['JP-1', 'JP-2'],
    now: 'JP-1',
    udp: true,
    xudp: true,
    tfo: false,
    hidden: false,
    icon: '',
    testUrl: 'https://www.gstatic.com/generate_204',
    extra: {},
    history: [
      { time: new Date(Date.now() - 60000).toISOString(), delay: 95 },
      { time: new Date().toISOString(), delay: 88 },
    ],
  },
  {
    name: 'US-Auto',
    type: 'URLTest',
    all: ['US-1', 'US-2'],
    now: 'US-1',
    udp: true,
    xudp: true,
    tfo: false,
    hidden: false,
    icon: '',
    testUrl: 'https://www.gstatic.com/generate_204',
    extra: {},
    history: [
      { time: new Date(Date.now() - 60000).toISOString(), delay: 180 },
      { time: new Date().toISOString(), delay: 165 },
    ],
  },
  {
    name: 'SG-Auto',
    type: 'URLTest',
    all: ['SG-1'],
    now: 'SG-1',
    udp: true,
    xudp: true,
    tfo: false,
    hidden: false,
    icon: '',
    testUrl: 'https://www.gstatic.com/generate_204',
    extra: {},
    history: [
      { time: new Date(Date.now() - 60000).toISOString(), delay: 85 },
      { time: new Date().toISOString(), delay: 78 },
    ],
  },
  {
    name: 'TW-Auto',
    type: 'URLTest',
    all: ['TW-1'],
    now: 'TW-1',
    udp: true,
    xudp: true,
    tfo: false,
    hidden: false,
    icon: '',
    testUrl: 'https://www.gstatic.com/generate_204',
    extra: {},
    history: [
      { time: new Date(Date.now() - 60000).toISOString(), delay: 92 },
      { time: new Date().toISOString(), delay: 85 },
    ],
  },
  // Proxy nodes
  ...createMockProxyNodes('HK', 3).map((node) => ({
    ...node,
    all: undefined,
    hidden: false,
    icon: '',
  })),
  ...createMockProxyNodes('JP', 2).map((node) => ({
    ...node,
    all: undefined,
    hidden: false,
    icon: '',
  })),
  ...createMockProxyNodes('US', 2).map((node) => ({
    ...node,
    all: undefined,
    hidden: false,
    icon: '',
  })),
  ...createMockProxyNodes('SG', 1).map((node) => ({
    ...node,
    all: undefined,
    hidden: false,
    icon: '',
  })),
  ...createMockProxyNodes('TW', 1).map((node) => ({
    ...node,
    all: undefined,
    hidden: false,
    icon: '',
  })),
  // Built-in proxies
  {
    name: 'DIRECT',
    type: 'Direct',
    all: undefined,
    now: '',
    udp: true,
    xudp: false,
    tfo: false,
    hidden: false,
    icon: '',
    extra: {},
    history: [],
  },
  {
    name: 'REJECT',
    type: 'Reject',
    all: undefined,
    now: '',
    udp: true,
    xudp: false,
    tfo: false,
    hidden: false,
    icon: '',
    extra: {},
    history: [],
  },
]

export const mockProxyProviders: ProxyProvider[] = [
  {
    name: 'Provider-A',
    proxies: [
      {
        alive: true,
        type: 'vmess',
        name: 'Provider-A-HK-1',
        tfo: false,
        udp: true,
        xudp: true,
        now: '',
        id: 'provider-a-hk-1',
        extra: {
          'https://www.gstatic.com/generate_204': {
            history: [
              { time: new Date().toISOString(), delay: 72 },
              { time: new Date(Date.now() - 60000).toISOString(), delay: 78 },
            ],
          },
        },
        history: [
          { time: new Date().toISOString(), delay: 72 },
          { time: new Date(Date.now() - 60000).toISOString(), delay: 78 },
        ],
      },
      {
        alive: true,
        type: 'vmess',
        name: 'Provider-A-JP-1',
        tfo: false,
        udp: true,
        xudp: true,
        now: '',
        id: 'provider-a-jp-1',
        extra: {
          'https://www.gstatic.com/generate_204': {
            history: [
              { time: new Date().toISOString(), delay: 95 },
              { time: new Date(Date.now() - 60000).toISOString(), delay: 102 },
            ],
          },
        },
        history: [
          { time: new Date().toISOString(), delay: 95 },
          { time: new Date(Date.now() - 60000).toISOString(), delay: 102 },
        ],
      },
    ],
    testUrl: 'https://www.gstatic.com/generate_204',
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    vehicleType: 'HTTP',
    subscriptionInfo: {
      Download: 10737418240, // 10GB
      Upload: 2147483648, // 2GB
      Total: 107374182400, // 100GB
      Expire: Math.floor(Date.now() / 1000) + 2592000, // 30 days from now
    },
  },
]

export const mockRules: Rule[] = [
  { type: 'DOMAIN-SUFFIX', payload: 'google.com', proxy: 'Proxy', size: 0 },
  { type: 'DOMAIN-SUFFIX', payload: 'github.com', proxy: 'Proxy', size: 0 },
  { type: 'DOMAIN-SUFFIX', payload: 'twitter.com', proxy: 'Proxy', size: 0 },
  { type: 'DOMAIN-SUFFIX', payload: 'youtube.com', proxy: 'Proxy', size: 0 },
  { type: 'DOMAIN-KEYWORD', payload: 'google', proxy: 'Proxy', size: 0 },
  { type: 'GEOIP', payload: 'CN', proxy: 'DIRECT', size: 0 },
  { type: 'GEOSITE', payload: 'cn', proxy: 'DIRECT', size: 0 },
  { type: 'MATCH', payload: '', proxy: 'Proxy', size: 0 },
]

export const mockRuleProviders: RuleProvider[] = [
  {
    behavior: 'domain',
    format: 'yaml',
    name: 'reject',
    ruleCount: 12580,
    type: 'HTTP',
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    vehicleType: 'HTTP',
  },
  {
    behavior: 'domain',
    format: 'yaml',
    name: 'direct',
    ruleCount: 8432,
    type: 'HTTP',
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    vehicleType: 'HTTP',
  },
  {
    behavior: 'domain',
    format: 'yaml',
    name: 'proxy',
    ruleCount: 25678,
    type: 'HTTP',
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    vehicleType: 'HTTP',
  },
]

// Generate mock connections with realistic data
const mockHosts = [
  'www.google.com',
  'api.github.com',
  'twitter.com',
  'www.youtube.com',
  'cdn.jsdelivr.net',
  'registry.npmjs.org',
  'api.openai.com',
  'cloud.google.com',
  'aws.amazon.com',
  's3.amazonaws.com',
]

const mockProcesses = [
  'Chrome',
  'Firefox',
  'Safari',
  'curl',
  'node',
  'python3',
  'Slack',
  'Discord',
  'Telegram',
  'Spotify',
]

const mockChains = [
  ['HK-1', 'Proxy', 'GLOBAL'],
  ['JP-1', 'Proxy', 'GLOBAL'],
  ['US-1', 'Proxy', 'GLOBAL'],
  ['DIRECT'],
  ['HK-2', 'Auto', 'Proxy', 'GLOBAL'],
  ['SG-1', 'Proxy', 'GLOBAL'],
]

// Store connection state for consistent speed calculations
const connectionState = new Map<string, { download: number; upload: number }>()

export const generateMockConnections = (count: number): Connection[] => {
  const now = Date.now()

  return Array.from({ length: count }, (_, i) => {
    const id = `mock-conn-${i}`
    const prev = connectionState.get(id) || { download: 0, upload: 0 }

    // Increment download/upload by random amount (simulating traffic)
    const downloadIncrement = Math.floor(Math.random() * 102400) // 0-100KB increment
    const uploadIncrement = Math.floor(Math.random() * 10240) // 0-10KB increment

    const newDownload = prev.download + downloadIncrement
    const newUpload = prev.upload + uploadIncrement

    // Store new state
    connectionState.set(id, { download: newDownload, upload: newUpload })

    return {
      id,
      download: newDownload,
      upload: newUpload,
      downloadSpeed: downloadIncrement, // Speed = increment since last update
      uploadSpeed: uploadIncrement,
      chains: mockChains[Math.floor(Math.random() * mockChains.length)],
      rule: 'GEOSITE',
      rulePayload: 'geolocation-!cn',
      start: new Date(now - Math.random() * 3600000).toISOString(),
      metadata: {
        network: Math.random() > 0.3 ? 'tcp' : 'udp',
        type: 'HTTPS',
        destinationIP: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        destinationPort: String(443),
        dnsMode: 'normal',
        host: mockHosts[Math.floor(Math.random() * mockHosts.length)],
        inboundIP: '127.0.0.1',
        inboundName: 'mixed-in',
        inboundPort: '7890',
        inboundUser: '',
        process:
          mockProcesses[Math.floor(Math.random() * mockProcesses.length)],
        processPath:
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        remoteDestination: '',
        sniffHost: '',
        sourceIP: '127.0.0.1',
        sourcePort: String(50000 + Math.floor(Math.random() * 10000)),
        specialProxy: '',
        specialRules: '',
        uid: 501,
      },
    }
  })
}

export const mockLogs: Log[] = [
  {
    type: LOG_LEVEL.Info,
    payload:
      '[TCP] 127.0.0.1:52341 --> www.google.com:443 match GEOSITE(geolocation-!cn) using Proxy[HK-1]',
  },
  {
    type: LOG_LEVEL.Info,
    payload:
      '[TCP] 127.0.0.1:52342 --> api.github.com:443 match GEOSITE(geolocation-!cn) using Proxy[HK-1]',
  },
  {
    type: LOG_LEVEL.Info,
    payload:
      '[UDP] 127.0.0.1:52343 --> dns.google:53 match GEOSITE(geolocation-!cn) using Proxy[JP-1]',
  },
  { type: LOG_LEVEL.Warning, payload: '[DNS] resolve www.example.com timeout' },
  {
    type: LOG_LEVEL.Info,
    payload:
      '[TCP] 127.0.0.1:52344 --> twitter.com:443 match GEOSITE(geolocation-!cn) using Proxy[US-1]',
  },
  { type: LOG_LEVEL.Debug, payload: '[PROXY] HK-1 latency test: 68ms' },
  {
    type: LOG_LEVEL.Info,
    payload:
      '[TCP] 127.0.0.1:52345 --> cdn.jsdelivr.net:443 match GEOSITE(cdn) using DIRECT',
  },
  {
    type: LOG_LEVEL.Info,
    payload:
      '[TCP] 127.0.0.1:52346 --> registry.npmjs.org:443 match GEOSITE(geolocation-!cn) using Proxy[HK-2]',
  },
]

export const mockConfig: Partial<Config> = {
  mode: 'rule',
  'mode-list': ['rule', 'global', 'direct'],
  port: 7890,
  'socks-port': 7891,
  'redir-port': 0,
  'tproxy-port': 0,
  'mixed-port': 7890,
  tun: {
    enable: true,
    device: 'utun',
    stack: 'system',
    'dns-hijack': null,
    'auto-route': true,
    'auto-detect-interface': true,
    'file-descriptor': 0,
  },
  'tuic-server': {
    enable: false,
    listen: '',
    certificate: '',
    'private-key': '',
  },
  'ss-config': '',
  'vmess-config': '',
  'allow-lan': true,
  'bind-address': '*',
  authentication: null,
  'log-level': 'info',
  ipv6: true,
  'geodata-mode': true,
  'tcp-concurrent': true,
  'find-process-mode': 'strict',
  'global-client-fingerprint': false,
  'interface-name': '',
  sniffing: true,
}

export const mockMemory = {
  inuse: 52428800, // 50MB
  oslimit: 0,
}

export const mockTraffic = {
  up: 1048576, // 1MB/s
  down: 5242880, // 5MB/s
}

export const mockVersion = {
  version: 'Mihomo Meta alpha-1234abcd',
  premium: true,
  meta: true,
}

// Mock WebSocket message generator for connections
export const generateMockConnectionsMessage = () => {
  const connections = generateMockConnections(25)
  const uploadTotal = connections.reduce((sum, c) => sum + c.upload, 0)
  const downloadTotal = connections.reduce((sum, c) => sum + c.download, 0)

  return {
    connections,
    uploadTotal,
    downloadTotal,
  }
}
