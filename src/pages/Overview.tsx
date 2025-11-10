import byteSize from 'byte-size'
import type { EChartsOption } from 'echarts'
import { EChartsAutoSize } from 'echarts-solid'
import { defaultsDeep } from 'lodash'
import type { JSX, ParentComponent } from 'solid-js'
import { DataUsageTable, DocumentTitle } from '~/components'
import { CHART_MAX_XAXIS, DEFAULT_CHART_OPTIONS } from '~/constants'
import { useI18n } from '~/i18n'
import { endpoint, latestConnectionMsg, useWsRequest } from '~/signals'

const formatDate = (value: number) => {
  const date = new Date(value)

  return `${date.getMinutes().toString().padStart(2, '0')}:${date
    .getSeconds()
    .toString()
    .padStart(2, '0')}`
}

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

  const [traffics, setTraffics] = createSignal<
    { down: number; up: number; time: Date }[]
  >([])
  const [memories, setMemories] = createSignal<
    { value: number; time: number }[]
  >([])

  const traffic = useWsRequest<{ down: number; up: number }>('traffic')

  createEffect(() => {
    const newTraffic = traffic()

    if (newTraffic) {
      setTraffics((traffics) => {
        const newTraffics = [...traffics, { ...newTraffic, time: new Date() }]

        if (newTraffics.length > CHART_MAX_XAXIS) {
          newTraffics.shift()
        }

        return newTraffics
      })
    }
  })

  const memory = useWsRequest<{ inuse: number }>('memory')

  createEffect(() => {
    const newMemory = memory()?.inuse

    if (newMemory) {
      setMemories((memories) => {
        const newMemories = [
          ...memories,
          { value: newMemory, time: Date.now() },
        ]

        if (newMemories.length > CHART_MAX_XAXIS) {
          newMemories.shift()
        }

        return newMemories
      })
    }
  })

  const trafficChartOptions = createMemo<EChartsOption>(() => {
    const data = traffics()

    return defaultsDeep(
      {
        title: { text: t('traffic') },
        xAxis: {
          axisLabel: {
            show: true,
            formatter: formatDate,
          },
        },
        series: [
          {
            name: t('down'),
            type: 'line',
            stack: 'traffic',
            smooth: true,
            showSymbol: false,
            data: data.map((t) => [t.time, t.down]),
          },
          {
            name: t('up'),
            type: 'line',
            stack: 'traffic',
            smooth: true,
            showSymbol: false,
            data: data.map((t) => [t.time, t.up]),
          },
        ],
      } satisfies EChartsOption,
      DEFAULT_CHART_OPTIONS,
    )
  })

  const flowChartOptions = createMemo<EChartsOption>(() => {
    return {
      title: { text: t('flow') },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (typeof params !== 'object' || Array.isArray(params)) return ''

          const name = params.name || ''
          const value = Number(params.value) || 0
          const percent = Number(params.percent) || 0

          return `${name}<br/>${byteSize(value).toString()} (${percent.toFixed(1)}%)`
        },
      },
      series: [
        {
          type: 'pie',
          labelLine: {
            show: false,
          },
          label: {
            show: false,
            position: 'center',
          },
          data: [
            {
              name: t('downloadTotal'),
              value: latestConnectionMsg()?.downloadTotal || 0,
            },
            {
              name: t('uploadTotal'),
              value: latestConnectionMsg()?.uploadTotal || 0,
            },
          ],
        },
      ],
    }
  })

  const memoryChartOptions = createMemo<EChartsOption>(() => {
    const data = memories()

    return defaultsDeep(
      {
        title: { text: t('memory') },
        xAxis: {
          axisLabel: {
            show: true,
            formatter: formatDate,
          },
        },
        series: [
          {
            name: t('memory'),
            type: 'line',
            smooth: true,
            showSymbol: false,
            data: data.map((m) => [m.time, m.value]),
          },
        ],
      } satisfies EChartsOption,
      DEFAULT_CHART_OPTIONS,
    )
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
            <EChartsAutoSize
              isLoading={traffics().length === 0}
              option={trafficChartOptions()}
            />
          </div>
          <div class="h-80">
            <EChartsAutoSize
              isLoading={latestConnectionMsg()?.connections?.length === 0}
              option={flowChartOptions()}
            />
          </div>
          <div class="h-80">
            <EChartsAutoSize
              isLoading={memories().length === 0}
              option={memoryChartOptions()}
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
