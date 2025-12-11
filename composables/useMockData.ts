import { LOG_LEVEL } from '~/constants'

// Use generic types to avoid strict type checking on mock data
// This data is only used for screenshots and testing

export const mockVersion = {
  meta: true,
  version: 'v1.18.0',
}

export const mockConfig = {
  port: 7890,
  'socks-port': 7891,
  'redir-port': 0,
  'tproxy-port': 0,
  'mixed-port': 7893,
  mode: 'rule',
  'log-level': 'info',
  'allow-lan': false,
  ipv6: false,
  tun: {
    enable: false,
    device: 'utun',
    stack: 'system',
    'dns-hijack': null,
    'auto-route': true,
    'auto-detect-interface': true,
    'file-descriptor': 0,
  },
}

// Helper to create metadata
function createMetadata(host: string, destIP: string, process = '') {
  return {
    network: 'tcp',
    type: 'HTTP Connect',
    destinationIP: destIP,
    destinationPort: '443',
    dnsMode: 'normal',
    host,
    inboundIP: '127.0.0.1',
    inboundName: 'mixed-in',
    inboundPort: '7893',
    inboundUser: '',
    process,
    processPath: process ? `/Applications/${process}.app` : '',
    remoteDestination: '',
    sniffHost: host,
    sourceIP: '192.168.1.100',
    sourcePort: '52341',
    specialProxy: '',
    specialRules: '',
    uid: 501,
  }
}

// Helper to create proxy
function createProxy(
  name: string,
  type: string,
  delay?: number,
  all?: string[],
  now?: string,
) {
  return {
    name,
    type,
    all: all || [],
    history: delay ? [{ delay, time: new Date().toISOString() }] : [],
    udp: true,
    xudp: type === 'Hysteria2' || type === 'VLESS',
    tfo: false,
    extra: {},
    hidden: false,
    now: now || '',
  }
}

// Helper to create proxy node for providers
function createProxyNode(name: string, type: string, delay?: number) {
  return {
    name,
    type,
    alive: true,
    tfo: false,
    udp: true,
    xudp: false,
    now: '',
    id: name,
    extra: {},
    history: delay ? [{ delay, time: new Date().toISOString() }] : [],
  }
}

export const mockProxies = {
  DIRECT: createProxy('DIRECT', 'Direct'),
  REJECT: createProxy('REJECT', 'Reject'),
  'Hong Kong': createProxy('Hong Kong', 'Shadowsocks', 85),
  Japan: createProxy('Japan', 'Vmess', 120),
  Singapore: createProxy('Singapore', 'Trojan', 65),
  'United States': createProxy('United States', 'Hysteria2', 180),
  Taiwan: createProxy('Taiwan', 'VLESS', 95),
  'Auto Select': createProxy(
    'Auto Select',
    'URLTest',
    undefined,
    ['Hong Kong', 'Japan', 'Singapore', 'United States', 'Taiwan'],
    'Singapore',
  ),
  Proxy: createProxy(
    'Proxy',
    'Selector',
    undefined,
    [
      'Auto Select',
      'Hong Kong',
      'Japan',
      'Singapore',
      'United States',
      'Taiwan',
      'DIRECT',
    ],
    'Auto Select',
  ),
  Streaming: createProxy(
    'Streaming',
    'Selector',
    undefined,
    ['Proxy', 'Hong Kong', 'Japan', 'Singapore', 'Taiwan', 'DIRECT'],
    'Japan',
  ),
  'AI Services': createProxy(
    'AI Services',
    'Selector',
    undefined,
    ['Proxy', 'United States', 'Japan', 'Singapore'],
    'United States',
  ),
}

export const mockProxyProviders = {
  'Provider A': {
    name: 'Provider A',
    type: 'Proxy',
    vehicleType: 'HTTP',
    testUrl: 'https://www.gstatic.com/generate_204',
    proxies: [
      createProxyNode('Hong Kong', 'Shadowsocks', 85),
      createProxyNode('Japan', 'Vmess', 120),
      createProxyNode('Singapore', 'Trojan', 65),
    ],
    updatedAt: new Date().toISOString(),
    subscriptionInfo: {
      Upload: 1024 * 1024 * 100,
      Download: 1024 * 1024 * 500,
      Total: 1024 * 1024 * 1024 * 100,
      Expire: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    },
  },
  'Provider B': {
    name: 'Provider B',
    type: 'Proxy',
    vehicleType: 'File',
    testUrl: 'https://www.gstatic.com/generate_204',
    proxies: [
      createProxyNode('United States', 'Hysteria2', 180),
      createProxyNode('Taiwan', 'VLESS', 95),
    ],
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    subscriptionInfo: {
      Upload: 1024 * 1024 * 50,
      Download: 1024 * 1024 * 200,
      Total: 1024 * 1024 * 1024 * 50,
      Expire: Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60,
    },
  },
}

export const mockRules = generateMockRules()

// Generate 50+ rules with realistic data
function generateMockRules() {
  const rules = [
    // Domain suffix rules
    { type: 'DOMAIN-SUFFIX', payload: 'google.com', proxy: 'Proxy', size: 156 },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'googleapis.com',
      proxy: 'Proxy',
      size: 89,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'gstatic.com',
      proxy: 'Proxy',
      size: 234,
    },
    { type: 'DOMAIN-SUFFIX', payload: 'github.com', proxy: 'Proxy', size: 178 },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'githubusercontent.com',
      proxy: 'Proxy',
      size: 445,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'openai.com',
      proxy: 'AI Services',
      size: 67,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'anthropic.com',
      proxy: 'AI Services',
      size: 34,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'claude.ai',
      proxy: 'AI Services',
      size: 23,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'netflix.com',
      proxy: 'Streaming',
      size: 512,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'nflxvideo.net',
      proxy: 'Streaming',
      size: 1024,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'youtube.com',
      proxy: 'Streaming',
      size: 789,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'ytimg.com',
      proxy: 'Streaming',
      size: 456,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'googlevideo.com',
      proxy: 'Streaming',
      size: 2048,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'twitter.com',
      proxy: 'Proxy',
      size: 345,
    },
    { type: 'DOMAIN-SUFFIX', payload: 'x.com', proxy: 'Proxy', size: 123 },
    { type: 'DOMAIN-SUFFIX', payload: 'twimg.com', proxy: 'Proxy', size: 567 },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'facebook.com',
      proxy: 'Proxy',
      size: 890,
    },
    { type: 'DOMAIN-SUFFIX', payload: 'fbcdn.net', proxy: 'Proxy', size: 1234 },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'instagram.com',
      proxy: 'Proxy',
      size: 678,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'cdninstagram.com',
      proxy: 'Proxy',
      size: 901,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'telegram.org',
      proxy: 'Proxy',
      size: 234,
    },
    { type: 'DOMAIN-SUFFIX', payload: 't.me', proxy: 'Proxy', size: 56 },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'whatsapp.com',
      proxy: 'Proxy',
      size: 345,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'discord.com',
      proxy: 'Proxy',
      size: 456,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'discordapp.com',
      proxy: 'Proxy',
      size: 567,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'spotify.com',
      proxy: 'Streaming',
      size: 678,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'scdn.co',
      proxy: 'Streaming',
      size: 789,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'twitch.tv',
      proxy: 'Streaming',
      size: 890,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'ttvnw.net',
      proxy: 'Streaming',
      size: 1567,
    },
    { type: 'DOMAIN-SUFFIX', payload: 'reddit.com', proxy: 'Proxy', size: 234 },
    { type: 'DOMAIN-SUFFIX', payload: 'redd.it', proxy: 'Proxy', size: 123 },
    { type: 'DOMAIN-SUFFIX', payload: 'medium.com', proxy: 'Proxy', size: 345 },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'wikipedia.org',
      proxy: 'Proxy',
      size: 456,
    },
    {
      type: 'DOMAIN-SUFFIX',
      payload: 'wikimedia.org',
      proxy: 'Proxy',
      size: 567,
    },
    // Domain keyword rules
    { type: 'DOMAIN-KEYWORD', payload: 'google', proxy: 'Proxy', size: 12 },
    { type: 'DOMAIN-KEYWORD', payload: 'facebook', proxy: 'Proxy', size: 8 },
    { type: 'DOMAIN-KEYWORD', payload: 'youtube', proxy: 'Streaming', size: 6 },
    { type: 'DOMAIN-KEYWORD', payload: 'twitter', proxy: 'Proxy', size: 5 },
    { type: 'DOMAIN-KEYWORD', payload: 'netflix', proxy: 'Streaming', size: 4 },
    // GeoIP rules
    { type: 'GEOIP', payload: 'CN', proxy: 'DIRECT', size: 8945 },
    { type: 'GEOIP', payload: 'PRIVATE', proxy: 'DIRECT', size: 156 },
    // IP-CIDR rules
    { type: 'IP-CIDR', payload: '192.168.0.0/16', proxy: 'DIRECT', size: 1 },
    { type: 'IP-CIDR', payload: '10.0.0.0/8', proxy: 'DIRECT', size: 1 },
    { type: 'IP-CIDR', payload: '172.16.0.0/12', proxy: 'DIRECT', size: 1 },
    { type: 'IP-CIDR', payload: '127.0.0.0/8', proxy: 'DIRECT', size: 1 },
    { type: 'IP-CIDR', payload: '100.64.0.0/10', proxy: 'DIRECT', size: 1 },
    { type: 'IP-CIDR6', payload: '::1/128', proxy: 'DIRECT', size: 1 },
    { type: 'IP-CIDR6', payload: 'fc00::/7', proxy: 'DIRECT', size: 1 },
    { type: 'IP-CIDR6', payload: 'fe80::/10', proxy: 'DIRECT', size: 1 },
    // Process rules
    { type: 'PROCESS-NAME', payload: 'Telegram', proxy: 'Proxy', size: 1 },
    { type: 'PROCESS-NAME', payload: 'Discord', proxy: 'Proxy', size: 1 },
    { type: 'PROCESS-NAME', payload: 'Spotify', proxy: 'Streaming', size: 1 },
    // Rule-set rules
    { type: 'RULE-SET', payload: 'reject', proxy: 'REJECT', size: 1234 },
    { type: 'RULE-SET', payload: 'direct', proxy: 'DIRECT', size: 5678 },
    { type: 'RULE-SET', payload: 'proxy', proxy: 'Proxy', size: 2345 },
    // Match rule (final)
    { type: 'MATCH', payload: '', proxy: 'Proxy', size: 1 },
  ]

  return rules
}

export const mockRuleProviders = {
  reject: {
    name: 'reject',
    type: 'Rule',
    behavior: 'domain',
    ruleCount: 1234,
    updatedAt: new Date().toISOString(),
    vehicleType: 'HTTP',
    format: 'yaml',
  },
  direct: {
    name: 'direct',
    type: 'Rule',
    behavior: 'domain',
    ruleCount: 5678,
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    vehicleType: 'HTTP',
    format: 'yaml',
  },
  proxy: {
    name: 'proxy',
    type: 'Rule',
    behavior: 'classical',
    ruleCount: 2345,
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    vehicleType: 'HTTP',
    format: 'yaml',
  },
}

export const mockConnections = generateMockConnections()

// Generate 50+ connections with realistic data
function generateMockConnections() {
  const hosts = [
    {
      host: 'www.google.com',
      ip: '142.250.185.14',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'google.com',
    },
    {
      host: 'github.com',
      ip: '140.82.121.4',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'github.com',
    },
    {
      host: 'api.github.com',
      ip: '140.82.121.6',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'github.com',
    },
    {
      host: 'raw.githubusercontent.com',
      ip: '185.199.108.133',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'githubusercontent.com',
    },
    {
      host: 'www.youtube.com',
      ip: '172.217.14.110',
      proxy: 'Streaming',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'youtube.com',
    },
    {
      host: 'i.ytimg.com',
      ip: '172.217.14.118',
      proxy: 'Streaming',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'ytimg.com',
    },
    {
      host: 'api.openai.com',
      ip: '104.18.12.191',
      proxy: 'AI Services',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'openai.com',
    },
    {
      host: 'chat.openai.com',
      ip: '104.18.13.191',
      proxy: 'AI Services',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'openai.com',
    },
    {
      host: 'api.anthropic.com',
      ip: '104.18.32.47',
      proxy: 'AI Services',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'anthropic.com',
    },
    {
      host: 'claude.ai',
      ip: '104.18.33.47',
      proxy: 'AI Services',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'claude.ai',
    },
    {
      host: 'www.netflix.com',
      ip: '54.74.73.31',
      proxy: 'Streaming',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'netflix.com',
    },
    {
      host: 'twitter.com',
      ip: '104.244.42.1',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'twitter.com',
    },
    {
      host: 'x.com',
      ip: '104.244.42.65',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'x.com',
    },
    {
      host: 'www.facebook.com',
      ip: '157.240.1.35',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'facebook.com',
    },
    {
      host: 'www.instagram.com',
      ip: '157.240.1.174',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'instagram.com',
    },
    {
      host: 'web.telegram.org',
      ip: '149.154.167.99',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'telegram.org',
    },
    {
      host: 'discord.com',
      ip: '162.159.130.234',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'discord.com',
    },
    {
      host: 'cdn.discordapp.com',
      ip: '162.159.133.234',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'discordapp.com',
    },
    {
      host: 'open.spotify.com',
      ip: '35.186.224.25',
      proxy: 'Streaming',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'spotify.com',
    },
    {
      host: 'www.twitch.tv',
      ip: '151.101.2.167',
      proxy: 'Streaming',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'twitch.tv',
    },
    {
      host: 'www.reddit.com',
      ip: '151.101.1.140',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'reddit.com',
    },
    {
      host: 'medium.com',
      ip: '162.159.152.4',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'medium.com',
    },
    {
      host: 'en.wikipedia.org',
      ip: '208.80.154.224',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'wikipedia.org',
    },
    {
      host: 'www.whatsapp.com',
      ip: '157.240.1.60',
      proxy: 'Proxy',
      rule: 'DOMAIN-SUFFIX',
      rulePayload: 'whatsapp.com',
    },
    {
      host: 'www.baidu.com',
      ip: '110.242.68.66',
      proxy: 'DIRECT',
      rule: 'GEOIP',
      rulePayload: 'CN',
    },
    {
      host: 'www.taobao.com',
      ip: '140.205.94.189',
      proxy: 'DIRECT',
      rule: 'GEOIP',
      rulePayload: 'CN',
    },
    {
      host: 'www.bilibili.com',
      ip: '120.92.78.97',
      proxy: 'DIRECT',
      rule: 'GEOIP',
      rulePayload: 'CN',
    },
    {
      host: 'www.zhihu.com',
      ip: '103.41.167.234',
      proxy: 'DIRECT',
      rule: 'GEOIP',
      rulePayload: 'CN',
    },
  ]

  const processes = [
    'Google Chrome',
    'Safari',
    'Firefox',
    'Visual Studio Code',
    'Electron',
    'node',
    'curl',
    'Telegram',
    'Discord',
    'Spotify',
  ]
  const chains = [
    ['Proxy', 'Auto Select', 'Hong Kong'],
    ['Proxy', 'Auto Select', 'Singapore'],
    ['Proxy', 'Auto Select', 'Japan'],
    ['Streaming', 'Japan'],
    ['Streaming', 'Hong Kong'],
    ['AI Services', 'United States'],
    ['DIRECT'],
  ]

  const connections = []

  for (let i = 0; i < 60; i++) {
    const hostInfo = hosts[i % hosts.length]!
    const process = processes[Math.floor(Math.random() * processes.length)]
    const chain =
      hostInfo.proxy === 'DIRECT'
        ? ['DIRECT']
        : chains[Math.floor(Math.random() * (chains.length - 1))]
    const isUDP = Math.random() > 0.85

    connections.push({
      id: `conn-${i + 1}`,
      metadata: {
        ...createMetadata(hostInfo.host, hostInfo.ip, process),
        network: isUDP ? 'udp' : 'tcp',
        type: isUDP ? 'QUIC' : 'HTTP Connect',
        sourcePort: String(50000 + i),
      },
      upload: Math.floor(Math.random() * 1024 * 1024),
      download: Math.floor(Math.random() * 1024 * 1024 * 10),
      downloadSpeed: Math.floor(Math.random() * 1024 * 500),
      uploadSpeed: Math.floor(Math.random() * 1024 * 100),
      start: new Date(
        Date.now() - Math.floor(Math.random() * 600000),
      ).toISOString(),
      chains: chain,
      rule: hostInfo.rule,
      rulePayload: hostInfo.rulePayload,
    })
  }

  return connections
}

export const mockLogs = generateMockLogs()

// Generate 50+ logs with realistic data
function generateMockLogs() {
  const logTemplates = [
    { type: LOG_LEVEL.Info, template: '[DNS] resolve {host} to {ip}' },
    {
      type: LOG_LEVEL.Info,
      template:
        '[TCP] {srcIP}:{srcPort} --> {host}:{destPort} match {rule}({payload}) using {proxy}',
    },
    {
      type: LOG_LEVEL.Info,
      template:
        '[UDP] {srcIP}:{srcPort} --> {host}:{destPort} match {rule}({payload}) using {proxy}',
    },
    { type: LOG_LEVEL.Debug, template: '[Proxy] {node} latency: {latency}ms' },
    {
      type: LOG_LEVEL.Warning,
      template: '[UDP] connection to {ip}:{destPort} timeout',
    },
    {
      type: LOG_LEVEL.Info,
      template: '[TUN] {srcIP} --> {host} using {proxy}',
    },
    { type: LOG_LEVEL.Debug, template: '[DNS] cache hit for {host}' },
    {
      type: LOG_LEVEL.Info,
      template:
        '[QUIC] {srcIP}:{srcPort} --> {host}:{destPort} match {rule}({payload}) using {proxy}',
    },
  ]

  const hosts = [
    'www.google.com',
    'github.com',
    'api.openai.com',
    'www.youtube.com',
    'twitter.com',
    'www.netflix.com',
    'discord.com',
    'www.twitch.tv',
    'open.spotify.com',
    'www.reddit.com',
    'medium.com',
    'www.facebook.com',
    'www.instagram.com',
    'web.telegram.org',
    'claude.ai',
    'www.baidu.com',
    'www.bilibili.com',
  ]
  const ips = [
    '142.250.185.14',
    '140.82.121.4',
    '104.18.12.191',
    '172.217.14.110',
    '104.244.42.1',
    '54.74.73.31',
    '162.159.130.234',
    '151.101.2.167',
    '35.186.224.25',
    '151.101.1.140',
    '162.159.152.4',
    '157.240.1.35',
    '157.240.1.174',
    '149.154.167.99',
    '104.18.33.47',
    '110.242.68.66',
    '120.92.78.97',
  ]
  const nodes = ['Hong Kong', 'Singapore', 'Japan', 'United States', 'Taiwan']
  const proxies = [
    'Proxy[Auto Select(Hong Kong)]',
    'Proxy[Auto Select(Singapore)]',
    'Streaming[Japan]',
    'AI Services[United States]',
    'DIRECT',
  ]
  const rules = ['DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'GEOIP', 'IP-CIDR', 'MATCH']

  const logs = []

  for (let i = 0; i < 60; i++) {
    const template = logTemplates[i % logTemplates.length]!
    const host = hosts[Math.floor(Math.random() * hosts.length)]
    const ip = ips[Math.floor(Math.random() * ips.length)]
    const node = nodes[Math.floor(Math.random() * nodes.length)]
    const proxy = proxies[Math.floor(Math.random() * proxies.length)]
    const rule = rules[Math.floor(Math.random() * rules.length)]

    const payload = template.template
      .replace('{host}', host!)
      .replace('{ip}', ip!)
      .replace('{srcIP}', '192.168.1.100')
      .replace('{srcPort}', String(50000 + i))
      .replace('{destPort}', '443')
      .replace('{node}', node!)
      .replace('{latency}', String(50 + Math.floor(Math.random() * 150)))
      .replace('{proxy}', proxy!)
      .replace('{rule}', rule!)
      .replace('{payload}', host!)

    logs.push({
      type: template.type,
      payload,
    })
  }

  return logs
}

export const mockTrafficStats = {
  up: 125000000,
  down: 850000000,
}

export const mockMemory = {
  inuse: 45 * 1024 * 1024,
  oslimit: 0,
}

// Composable for accessing mock data
export function useMockData() {
  return {
    mockVersion,
    mockConfig,
    mockProxies,
    mockProxyProviders,
    mockRules,
    mockRuleProviders,
    mockConnections,
    mockLogs,
    mockTrafficStats,
    mockMemory,
  }
}
