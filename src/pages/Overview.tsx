import byteSize from 'byte-size'
import Highcharts from 'highcharts'
import type { JSX, ParentComponent } from 'solid-js'
import { DataUsageTable, DocumentTitle } from '~/components'
import { HighchartsAutoSize } from '~/components/HighchartsAutoSize'
import {
  type RealtimeChartRef,
  RealtimeLineChartWithRef,
} from '~/components/RealtimeLineChart'
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

  // Track data point count to determine whether to show loading
  const [trafficDataCount, setTrafficDataCount] = createSignal(0)
  const [memoryDataCount, setMemoryDataCount] = createSignal(0)

  // Chart refs for real-time updates
  let trafficChartRef: RealtimeChartRef | undefined
  let memoryChartRef: RealtimeChartRef | undefined

  const traffic = useWsRequest<{ down: number; up: number }>('traffic')

  createEffect(() => {
    const newTraffic = traffic()

    if (newTraffic && trafficChartRef) {
      const time = Date.now()
      trafficChartRef.addPoints([
        { seriesIndex: 0, time, value: newTraffic.down },
        { seriesIndex: 1, time, value: newTraffic.up },
      ])
      setTrafficDataCount((c) => c + 1)
    }
  })

  const memory = useWsRequest<{ inuse: number }>('memory')

  createEffect(() => {
    const newMemory = memory()?.inuse

    if (newMemory && memoryChartRef) {
      const time = Date.now()
      memoryChartRef.addPoint(0, time, newMemory)
      setMemoryDataCount((c) => c + 1)
    }
  })

  // Flow chart (pie chart) options using Highcharts
  const flowChartOptions = createMemo<Highcharts.Options>(() => {
    return {
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
        animation: false,
      },
      credits: {
        enabled: false,
      },
      title: {
        text: t('flow'),
        style: {
          color: 'oklch(0.746477 0 0)',
        },
      },
      tooltip: {
        pointFormatter: function () {
          const value = this.y || 0
          const percent =
            (this as Highcharts.Point & { percentage?: number }).percentage || 0

          return `${this.name}<br/>${byteSize(value).toString()} (${percent.toFixed(1)}%)`
        },
      },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: false,
          },
          showInLegend: true,
          animation: false,
        },
      },
      legend: {
        itemStyle: {
          color: 'oklch(0.746477 0 0)',
        },
        itemHoverStyle: {
          color: 'oklch(0.9 0 0)',
        },
      },
      series: [
        {
          type: 'pie',
          name: t('flow'),
          data: [
            {
              name: t('downloadTotal'),
              y: latestConnectionMsg()?.downloadTotal || 0,
              color: Highcharts.getOptions().colors?.[0],
            },
            {
              name: t('uploadTotal'),
              y: latestConnectionMsg()?.uploadTotal || 0,
              color: Highcharts.getOptions().colors?.[1],
            },
          ],
        },
      ],
    }
  })

  return (
    <>
      <DocumentTitle>{t('overview')}</DocumentTitle>

      <div class="flex flex-col gap-2 lg:h-full">
        <div class="stats w-full shrink-0 stats-vertical grid-cols-2 bg-primary shadow lg:flex lg:stats-horizontal">
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

        <div class="grid grid-cols-1 gap-2 rounded-box bg-base-300 py-4 lg:grid-cols-3">
          <div class="h-80">
            <RealtimeLineChartWithRef
              ref={(ref: RealtimeChartRef) => (trafficChartRef = ref)}
              title={t('traffic')}
              seriesConfig={[
                { name: t('down'), color: '#7cb5ec' },
                { name: t('up'), color: '#90ed7d' },
              ]}
              isLoading={trafficDataCount() === 0}
            />
          </div>
          <div class="h-80">
            <HighchartsAutoSize
              isLoading={latestConnectionMsg()?.connections?.length === 0}
              options={flowChartOptions()}
            />
          </div>
          <div class="h-80">
            <RealtimeLineChartWithRef
              ref={(ref: RealtimeChartRef) => (memoryChartRef = ref)}
              title={t('memory')}
              seriesConfig={[{ name: t('memory'), color: '#f7a35c' }]}
              isLoading={memoryDataCount() === 0}
            />
          </div>
        </div>

        <DataUsageTable />

        <footer class="mx-auto mt-4 footer block footer-horizontal rounded-box bg-neutral p-4 text-center text-lg font-bold text-neutral-content">
          {endpoint()?.url}
        </footer>
      </div>
    </>
  )
}
