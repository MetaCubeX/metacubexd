export interface TrafficCounter {
  up: number
  down: number
}

export interface HostTrafficResult {
  host: string
  proxy: TrafficCounter
  direct: TrafficCounter
  conns: number
  last_seen: number
}

export interface TrafficHostsResponse {
  since: number
  until: number
  totals: {
    proxy: TrafficCounter
    direct: TrafficCounter
  }
  hosts: HostTrafficResult[]
}
