import byteSize from 'byte-size'
import Highcharts from 'highcharts'
import type { JSX, ParentComponent } from 'solid-js'
import { DataUsageTable, DocumentTitle } from '~/components'
import { HighchartsAutoSize } from '~/components/HighchartsAutoSize'
import {
  type RealtimeChartRef,
  RealtimeLineChartWithRef,
} from '~/components/RealtimeLineChart'
import { getChartThemeColors } from '~/helpers'
import { useI18n } from '~/i18n'
import {
  addMemoryDataPoint,
  addTrafficDataPoint,
  endpoint,
  latestConnectionMsg,
  latestMemory,
  latestTraffic,
  memoryChartHistory,
  trafficChartHistory,
} from '~/signals'

const TrafficWidget: ParentComponent<{ label: JSX.Element }> = (props) => (
  <div class="stat flex-1 place-items-center">
    <div class="stat-title text-primary-content">{props.label}</div>
    <div class="stat-value w-full truncate text-center text-2xl text-primary-content lg:text-3xl">
      {children(() => props.children)()}
    </div>
  </div>
)

export default () => {
  const [t] = useI18n()

  // Chart refs for real-time updates
  let trafficChartRef: RealtimeChartRef | undefined
  let memoryChartRef: RealtimeChartRef | undefined

  // Initialize prevTime from history to prevent duplicate points on remount
  let prevTrafficTime =
    trafficChartHistory.download.length > 0
      ? trafficChartHistory.download[trafficChartHistory.download.length - 1][0]
      : 0
  let prevMemoryTime =
    memoryChartHistory.length > 0
      ? memoryChartHistory[memoryChartHistory.length - 1][0]
      : 0

  createEffect(() => {
    const newTraffic = latestTraffic()

    if (newTraffic && trafficChartRef) {
      const time = Date.now()

      // Only add points if time has advanced (prevents duplicate points on remount)
      if (time > prevTrafficTime) {
        trafficChartRef.addPoints([
          { seriesIndex: 0, time, value: newTraffic.down },
          { seriesIndex: 1, time, value: newTraffic.up },
        ])
        // Store in global history
        addTrafficDataPoint(time, newTraffic.down, newTraffic.up)
        prevTrafficTime = time
      }
    }
  })

  createEffect(() => {
    const newMemory = latestMemory()?.inuse

    if (newMemory && memoryChartRef) {
      const time = Date.now()

      // Only add points if time has advanced (prevents duplicate points on remount)
      if (time > prevMemoryTime) {
        memoryChartRef.addPoint(0, time, newMemory)
        // Store in global history
        addMemoryDataPoint(time, newMemory)
        prevMemoryTime = time
      }
    }
  })

  // Flow chart (pie chart) options using Highcharts
  const flowChartOptions = createMemo<Highcharts.Options>(() => {
    const themeColors = getChartThemeColors()

    return {
      chart: {
        type: 'pie',
        backgroundColor: themeColors.backgroundColor,
        animation: false,
      },
      credits: {
        enabled: false,
      },
      title: {
        text: t('flow'),
        style: {
          color: themeColors.textColor,
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
          color: themeColors.textColor,
        },
        itemHoverStyle: {
          color: themeColors.textColorHover,
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
              color: themeColors.seriesColors[0],
            },
            {
              name: t('uploadTotal'),
              y: latestConnectionMsg()?.uploadTotal || 0,
              color: themeColors.seriesColors[1],
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
            {byteSize(latestTraffic()?.up || 0).toString()}/s
          </TrafficWidget>

          <TrafficWidget label={t('download')}>
            {byteSize(latestTraffic()?.down || 0).toString()}/s
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
            {byteSize(latestMemory()?.inuse || 0).toString()}
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
              initialData={[
                [...trafficChartHistory.download],
                [...trafficChartHistory.upload],
              ]}
              isLoading={!latestTraffic()}
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
              initialData={[[...memoryChartHistory]]}
              isLoading={!latestMemory()}
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
