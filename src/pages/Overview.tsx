import { createEventSignal } from '@solid-primitives/event-listener'
import { createReconnectingWS } from '@solid-primitives/websocket'
import { ApexOptions } from 'apexcharts'
import byteSize from 'byte-size'
import { SolidApexCharts } from 'solid-apexcharts'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { secret, wsEndpointURL } from '~/signals'
import type { Connection } from '~/types'

const defaultChartOptions: ApexOptions = {
  chart: {
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { easing: 'linear', dynamicAnimation: { speed: 1000 } },
  },
  noData: { text: 'Loading...' },
  legend: {
    fontSize: '14px',
    labels: { colors: 'gray' },
    itemMargin: { horizontal: 64 },
  },
  dataLabels: { enabled: false },
  grid: { yaxis: { lines: { show: false } } },
  stroke: { curve: 'smooth' },
  tooltip: { enabled: false },
  xaxis: { labels: { show: false }, axisTicks: { show: false } },
  yaxis: {
    labels: {
      style: { colors: 'gray' },
      formatter(val) {
        return byteSize(val).toString()
      },
    },
  },
}

export const Overview = () => {
  const [traffics, setTraffics] = createSignal<{ down: number; up: number }[]>(
    [],
  )
  const [memories, setMemories] = createSignal<number[]>([])

  const trafficWS = createReconnectingWS(
    `${wsEndpointURL()}/traffic?token=${secret()}}`,
  )

  const trafficWSMessageEvent = createEventSignal<{
    message: WebSocketEventMap['message']
  }>(trafficWS, 'message')

  const traffic = () => {
    const data = trafficWSMessageEvent()?.data

    return data ? (JSON.parse(data) as { down: number; up: number }) : null
  }

  createEffect(() => {
    const t = traffic()

    if (t) {
      setTraffics((traffics) => [...traffics, t].slice(-100))
    }
  })

  const trafficChartOptions = createMemo<ApexOptions>(() => ({
    title: { text: 'Traffic', align: 'center', style: { color: 'gray' } },
    ...defaultChartOptions,
  }))

  const trafficChartSeries = createMemo(() => [
    {
      name: 'Down',
      data: traffics().map((t) => t.down),
    },
    {
      name: 'Up',
      data: traffics().map((t) => t.up),
    },
  ])

  const memoryWS = createReconnectingWS(
    `${wsEndpointURL()}/memory?token=${secret()}`,
  )

  const memoryWSMessageEvent = createEventSignal<{
    message: WebSocketEventMap['message']
  }>(memoryWS, 'message')

  const memory = () => {
    const data = memoryWSMessageEvent()?.data

    return data ? (JSON.parse(data) as { inuse: number }).inuse : null
  }

  createEffect(() => {
    const m = memory()

    if (m) {
      setMemories((memories) => [...memories, m].slice(-100))
    }
  })

  const memoryChartOptions = createMemo<ApexOptions>(() => ({
    title: { text: 'Memory', align: 'center', style: { color: 'gray' } },
    ...defaultChartOptions,
  }))

  const memoryChartSeries = createMemo(() => [
    {
      name: 'memory',
      data: memories(),
    },
  ])

  const connectionsWS = createReconnectingWS(
    `${wsEndpointURL()}/connections?token=${secret()}}`,
  )

  const connectionsWSMessageEvent = createEventSignal<{
    message: WebSocketEventMap['message']
  }>(connectionsWS, 'message')

  const connection = () => {
    const data = connectionsWSMessageEvent()?.data

    return data
      ? (JSON.parse(data) as {
          downloadTotal: number
          uploadTotal: number
          connections: Connection[]
        })
      : null
  }

  return (
    <div class="flex flex-col gap-4">
      <div class="stats w-full shadow">
        <div class="stat">
          <div class="stat-title">Upload</div>
          <div class="stat-value">
            {byteSize(traffic()?.up || 0).toString()}/s
          </div>
        </div>
        <div class="stat">
          <div class="stat-title">Download</div>
          <div class="stat-value">
            {byteSize(traffic()?.down || 0).toString()}/s
          </div>
        </div>
        <div class="stat">
          <div class="stat-title">Upload Total</div>
          <div class="stat-value">
            {byteSize(connection()?.uploadTotal || 0).toString()}
          </div>
        </div>
        <div class="stat">
          <div class="stat-title">Download Total</div>
          <div class="stat-value">
            {byteSize(connection()?.downloadTotal || 0).toString()}
          </div>
        </div>
        <div class="stat">
          <div class="stat-title">Active Connections</div>
          <div class="stat-value">{connection()?.connections.length || 0}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Memory Usage</div>
          <div class="stat-value">{byteSize(memory() || 0).toString()}</div>
        </div>
      </div>

      <div class="mx-auto grid w-full max-w-screen-lg grid-cols-1 gap-4">
        <SolidApexCharts
          type="area"
          options={trafficChartOptions()}
          series={trafficChartSeries()}
        />

        <SolidApexCharts
          type="line"
          options={memoryChartOptions()}
          series={memoryChartSeries()}
        />
      </div>
    </div>
  )
}
