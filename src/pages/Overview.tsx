import { createEventSignal } from '@solid-primitives/event-listener'
import { useI18n } from '@solid-primitives/i18n'
import { createReconnectingWS } from '@solid-primitives/websocket'
import type { ApexOptions } from 'apexcharts'
import byteSize from 'byte-size'
import { SolidApexCharts } from 'solid-apexcharts'
import {
  JSX,
  ParentComponent,
  children,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js'
import { secret, wsEndpointURL } from '~/signals'
import type { Connection } from '~/types'

const CHART_MAX_XAXIS = 10

const TrafficWidget: ParentComponent<{ label: JSX.Element }> = (props) => (
  <div class="stat flex-1">
    <div class="stat-title text-primary-content">{props.label}</div>
    <div class="stat-value text-primary-content">
      {children(() => props.children)()}
    </div>
  </div>
)

export default () => {
  const [t] = useI18n()

  const [traffics, setTraffics] = createSignal<{ down: number; up: number }[]>(
    [],
  )
  const [memories, setMemories] = createSignal<number[]>([])
  // https://github.com/apexcharts/apexcharts.js/blob/main/samples/source/line/realtime.xml
  // TODO: need a better way
  const preventLeakTimer = setInterval(
    () => {
      setTraffics((traffics) => traffics.slice(-CHART_MAX_XAXIS))
      setMemories((memo) => memo.slice(-CHART_MAX_XAXIS))
    },
    // we shrink the chart data array size down every 10 minutes
    10 * 60 * 1000,
  )

  onCleanup(() => clearInterval(preventLeakTimer))

  const trafficWS = createReconnectingWS(
    `${wsEndpointURL()}/traffic?token=${secret()}`,
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
      setTraffics((traffics) => [...traffics, t])
    }
  })

  const defaultChartOptions: ApexOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { easing: 'linear' },
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
    xaxis: {
      range: CHART_MAX_XAXIS,
      labels: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: 'gray' },
        formatter(val) {
          return byteSize(val).toString()
        },
      },
    },
  }

  const trafficChartOptions = createMemo<ApexOptions>(() => ({
    title: {
      text: t('traffic'),
      align: 'center',
      style: { color: 'gray' },
    },
    ...defaultChartOptions,
  }))

  const trafficChartSeries = createMemo(() => [
    {
      name: t('down'),
      data: traffics().map((t) => t.down),
    },
    {
      name: t('up'),
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
      setMemories((memories) => [...memories, m])
    }
  })

  const memoryChartOptions = createMemo<ApexOptions>(() => ({
    title: {
      text: t('memory'),
      align: 'center',
      style: { color: 'gray' },
    },
    ...defaultChartOptions,
  }))

  const memoryChartSeries = createMemo(() => [{ data: memories() }])

  const connectionsWS = createReconnectingWS(
    `${wsEndpointURL()}/connections?token=${secret()}`,
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
      <div class="stats stats-vertical w-full grid-cols-2 bg-primary shadow lg:stats-horizontal lg:flex">
        <TrafficWidget label={t('upload')}>
          {byteSize(traffic()?.up || 0).toString()}/s
        </TrafficWidget>

        <TrafficWidget label={t('download')}>
          {byteSize(traffic()?.down || 0).toString()}/s
        </TrafficWidget>

        <TrafficWidget label={t('uploadTotal')}>
          {byteSize(connection()?.uploadTotal || 0).toString()}
        </TrafficWidget>

        <TrafficWidget label={t('downloadTotal')}>
          {byteSize(connection()?.downloadTotal || 0).toString()}
        </TrafficWidget>

        <TrafficWidget label={t('activeConnections')}>
          {connection()?.connections.length || 0}
        </TrafficWidget>

        <TrafficWidget label={t('memoryUsage')}>
          {byteSize(memory() || 0).toString()}
        </TrafficWidget>
      </div>

      <div class="flex flex-col sm:flex-row">
        <div class="m-4 flex-1">
          <SolidApexCharts
            type="area"
            options={trafficChartOptions()}
            series={trafficChartSeries()}
          />
        </div>
        <div class="m-4 flex-1">
          <SolidApexCharts
            type="line"
            options={memoryChartOptions()}
            series={memoryChartSeries()}
          />
        </div>
      </div>
    </div>
  )
}
