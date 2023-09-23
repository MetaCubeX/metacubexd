import { makeTimer } from '@solid-primitives/timer'
import type { ApexOptions } from 'apexcharts'
import byteSize from 'byte-size'
import { merge } from 'lodash'
import { SolidApexCharts } from 'solid-apexcharts'
import {
  JSX,
  ParentComponent,
  batch,
  children,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js'
import { CHART_MAX_XAXIS, DEFAULT_CHART_OPTIONS } from '~/constants'
import { useI18n } from '~/i18n'
import { latestConnectionMsg, useWsRequest } from '~/signals'

const TrafficWidget: ParentComponent<{ label: JSX.Element }> = (props) => (
  <div class="stat flex-1 place-items-center">
    <div class="stat-title text-primary-content">{props.label}</div>
    <div class="stat-value text-2xl text-primary-content lg:text-3xl">
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
  // TODO: needs a better way
  makeTimer(
    () => {
      batch(() => {
        setTraffics((traffics) => traffics.slice(-CHART_MAX_XAXIS))
        setMemories((memo) => memo.slice(-CHART_MAX_XAXIS))
      })
    },
    // we shrink the chart data array size down every minute to prevent memory leaks
    60 * 1000,
    setInterval,
  )

  const traffic = useWsRequest<{ down: number; up: number }>('traffic')

  createEffect(() => {
    const t = traffic()

    if (t) setTraffics((traffics) => [...traffics, t])
  })

  const trafficChartOptions = createMemo<ApexOptions>(() =>
    merge({ title: { text: t('traffic') } }, DEFAULT_CHART_OPTIONS),
  )

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

  const memory = useWsRequest<{ inuse: number }>('memory')

  createEffect(() => {
    const m = memory()?.inuse

    if (m) setMemories((memories) => [...memories, m])
  })

  const memoryChartOptions = createMemo<ApexOptions>(() =>
    merge({ title: { text: t('memory') } }, DEFAULT_CHART_OPTIONS),
  )

  const memoryChartSeries = createMemo(() => [
    { name: t('memory'), data: memories() },
  ])

  return (
    <div class="flex flex-col gap-2">
      <div class="stats stats-vertical w-full grid-cols-2 bg-primary shadow lg:stats-horizontal lg:flex">
        <TrafficWidget label={t('upload')}>
          {byteSize(traffic()?.up || 0).toString()}/s
        </TrafficWidget>

        <TrafficWidget label={t('download')}>
          {byteSize(traffic()?.down || 0).toString()}/s
        </TrafficWidget>

        <TrafficWidget label={t('uploadTotal')}>
          {byteSize(latestConnectionMsg()?.uploadTotal || 0).toString()}
        </TrafficWidget>

        <TrafficWidget label={t('downloadTotal')}>
          {byteSize(latestConnectionMsg()?.downloadTotal || 0).toString()}
        </TrafficWidget>

        <TrafficWidget label={t('activeConnections')}>
          {latestConnectionMsg()?.connections?.length || 0}
        </TrafficWidget>

        <TrafficWidget label={t('memoryUsage')}>
          {byteSize(memory()?.inuse || 0).toString()}
        </TrafficWidget>
      </div>

      <div class="rounded-box flex flex-col gap-2 bg-base-300 py-4 lg:flex-row">
        <div class="flex-1">
          <SolidApexCharts
            type="area"
            options={trafficChartOptions()}
            series={trafficChartSeries()}
          />
        </div>
        <div class="flex-1">
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
