<script setup lang="ts">
import Highcharts from 'highcharts'
import { formatBytes, getChartThemeColors } from '~/utils'

interface TrendPoint {
  timestamp: number
  upload: number
  download: number
}

const props = defineProps<{
  data: TrendPoint[]
  startTime: number
  endTime: number
  isLoading?: boolean
  title?: string
}>()

const { t, locale } = useI18n()
const configStore = useConfigStore()
const containerRef = ref<HTMLDivElement>()
let chart: Highcharts.Chart | undefined

// Configure Highcharts to use local time (global setting)
if (typeof window !== 'undefined') {
  Highcharts.setOptions({
    time: { useUTC: false },
  })
}

const initChart = () => {
  if (!containerRef.value) return
  const themeColors = getChartThemeColors()

  chart = Highcharts.chart(containerRef.value, {
    chart: { type: 'areaspline', backgroundColor: 'transparent' },
    title: { text: undefined },
    credits: { enabled: false },
    accessibility: { enabled: false },
    xAxis: {
      type: 'datetime',
      min: props.startTime,
      max: props.endTime,
      labels: { style: { color: themeColors.textColor } },
      lineColor: themeColors.lineColor,
      tickColor: themeColors.tickColor,
    },
    yAxis: {
      title: { text: undefined },
      labels: {
        style: { color: themeColors.textColor },
        formatter() {
          return formatBytes(this.value as number)
        },
      },
      gridLineColor: themeColors.gridLineColor,
      min: 0,
    },
    legend: { itemStyle: { color: themeColors.textColor } },
    tooltip: {
      shared: true,
      formatter() {
        const time = Highcharts.dateFormat('%Y-%m-%d %H:%M', this.x as number)
        let html = `<b>${time}</b><br/>`
        this.points?.forEach((p) => {
          html += `<span style="color:${p.color}">\u25CF</span> ${p.series.name}: <b>${formatBytes(p.y as number)}</b><br/>`
        })
        return html
      },
    },
    plotOptions: {
      areaspline: {
        fillOpacity: 0.15,
        marker: { enabled: false },
        lineWidth: 1.5,
      },
    },
    series: [
      {
        type: 'areaspline',
        name: t('upload'),
        data: [],
        color: themeColors.seriesColors[0],
      },
      {
        type: 'areaspline',
        name: t('download'),
        data: [],
        color: themeColors.seriesColors[1],
      },
    ],
  })
}

const updateData = () => {
  if (!chart) return
  const uploadSeries = props.data.map((d) => [d.timestamp, d.upload])
  const downloadSeries = props.data.map((d) => [d.timestamp, d.download])
  chart.series[0]?.setData(uploadSeries, false)
  chart.series[1]?.setData(downloadSeries, false)
  chart.xAxis[0]?.update(
    {
      min: props.startTime,
      max: props.endTime,
    },
    true,
  )
}

watch(() => props.data, updateData, { deep: true })
watch([() => props.startTime, () => props.endTime], () => {
  if (chart) {
    chart.xAxis[0]?.update({ min: props.startTime, max: props.endTime }, true)
  }
})

watch([configStore.curTheme], () => {
  if (chart) {
    const themeColors = getChartThemeColors()
    chart.update({
      xAxis: {
        labels: { style: { color: themeColors.textColor } },
        lineColor: themeColors.lineColor,
      },
      yAxis: {
        labels: { style: { color: themeColors.textColor } },
        gridLineColor: themeColors.gridLineColor,
      },
      legend: { itemStyle: { color: themeColors.textColor } },
    })
  }
})

watch(locale, () => {
  if (chart) {
    chart.series[0]?.update({ name: t('upload') }, false)
    chart.series[1]?.update({ name: t('download') }, true)
  }
})

onMounted(() => {
  initChart()
  updateData()
  const resizeObserver = new ResizeObserver(() => {
    if (chart && containerRef.value) {
      chart.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
        true,
      )
    }
  })
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  if (chart) chart.destroy()
})
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <div v-if="title" class="flex items-center justify-center gap-2 px-4 py-2">
      <h3 class="text-lg font-bold tracking-wider text-base-content uppercase">
        {{ title }}
      </h3>
    </div>
    <div
      ref="containerRef"
      class="min-h-0 w-full flex-1 transition-opacity"
      :class="{ 'opacity-50': isLoading }"
    />
  </div>
</template>
