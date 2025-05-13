import { makeTimer } from '@solid-primitives/timer'
import type { ApexOptions } from 'apexcharts'
import byteSize from 'byte-size'
import { defaultsDeep } from 'lodash'
import { SolidApexCharts } from 'solid-apexcharts'
import type { JSX, ParentComponent } from 'solid-js'
import { DocumentTitle } from '~/components'
import { CHART_MAX_XAXIS, DEFAULT_CHART_OPTIONS } from '~/constants'
import { useI18n } from '~/i18n'
import { endpoint, latestConnectionMsg, useWsRequest } from '~/signals'

const TrafficWidget: ParentComponent<{ label: JSX.Element }> = (props) => (
  <div class="stat flex-1 place-items-center">
    <div class="stat-title text-primary-content">{props.label}</div>
    <div class="stat-value w-full truncate text-center text-2xl text-primary-content lg:text-3xl">
      {children(() => props.children)()}
    </div>
  </div>
)

export default () => {
  const navigate = useNavigate()

  if (!endpoint()) {
    navigate('/setup', { replace: true })

    return null
  }

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
    defaultsDeep({ title: { text: t('traffic') } }, DEFAULT_CHART_OPTIONS),
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

  const flowChartOptions = createMemo<ApexOptions>(() => {
    return defaultsDeep(
      {
        title: { text: t('flow') },
        labels: [t('downloadTotal'), t('uploadTotal')],
        tooltip: { enabled: true },
        chart: {
          animations: { enabled: false },
        },
      },
      DEFAULT_CHART_OPTIONS,
    )
  })

  const flowChartSeries = createMemo(() => [
    latestConnectionMsg()?.downloadTotal || 0,
    latestConnectionMsg()?.uploadTotal || 0,
  ])

  const memory = useWsRequest<{ inuse: number }>('memory')

  createEffect(() => {
    const m = memory()?.inuse

    if (m) setMemories((memories) => [...memories, m])
  })

  const memoryChartOptions = createMemo<ApexOptions>(() =>
    defaultsDeep({ title: { text: t('memory') } }, DEFAULT_CHART_OPTIONS),
  )

  const memoryChartSeries = createMemo(() => [
    { name: t('memory'), data: memories() },
  ])

  return (
    <>
      <DocumentTitle>{t('overview')}</DocumentTitle>

      <div class="flex flex-col gap-2 lg:h-full">
        <div class="stats w-full flex-shrink-0 stats-vertical grid-cols-2 bg-primary shadow lg:flex lg:stats-horizontal">
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

        <div class="flex flex-col gap-2 rounded-box bg-base-300 py-4 lg:flex-row">
          <div class="flex-1">
            <SolidApexCharts
              type="line"
              options={trafficChartOptions()}
              series={trafficChartSeries()}
            />
          </div>
          <div class="flex-1">
            <SolidApexCharts
              type="pie"
              options={flowChartOptions()}
              series={flowChartSeries()}
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

        <footer class="mx-auto mt-4 footer block footer-horizontal rounded-box bg-neutral p-4 text-center text-lg font-bold text-neutral-content">
          {endpoint()?.url}
        </footer>
      </div>
    </>
  )
}
