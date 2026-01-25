<script setup lang="ts">
import byteSize from 'byte-size'
import Highcharts from 'highcharts'
import { CHART_MAX_XAXIS } from '~/constants'
import { getChartThemeColors } from '~/utils'

interface SeriesConfig {
  name: string
  color?: string
}

interface Props {
  title: string
  seriesConfig: SeriesConfig[]
  isLoading?: boolean
  initialData?: [number, number][][]
  valueMode?: 'bytes' | 'number'
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  initialData: () => [],
  valueMode: 'bytes',
})

// Expose methods for parent component to add data points
const emit = defineEmits<{
  chartReady: [ref: ChartRef]
}>()

// Format value based on mode
const formatValue = (value: number, withSuffix = false) => {
  if (props.valueMode === 'number') {
    return String(value)
  }
  return withSuffix
    ? `${byteSize(value).toString()}/s`
    : byteSize(value).toString()
}

export interface ChartRef {
  addPoint: (seriesIndex: number, time: number, value: number) => void
  addPoints: (
    points: { seriesIndex: number; time: number; value: number }[],
  ) => void
  setSeriesData: (seriesIndex: number, data: [number, number][]) => void
}

const containerRef = ref<HTMLDivElement>()
let chart: Highcharts.Chart | undefined

const configStore = useConfigStore()

function createChartOptions(): Highcharts.Options {
  const themeColors = getChartThemeColors()

  return {
    chart: {
      type: 'areaspline',
      animation: {
        duration: 800,
        easing: 'linear',
      },
      backgroundColor: themeColors.backgroundColor,
    },
    credits: {
      enabled: false,
    },
    accessibility: {
      enabled: false,
    },
    title: {
      text: props.title,
      style: {
        color: themeColors.textColor,
      },
    },
    legend: {
      enabled: true,
      itemStyle: {
        color: themeColors.textColor,
      },
      itemHoverStyle: {
        color: themeColors.textColorHover,
      },
    },
    xAxis: {
      type: 'datetime',
      tickPixelInterval: 100,
      labels: {
        style: {
          color: themeColors.textColor,
        },
        formatter() {
          const date = new Date(this.value as number)
          return `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
        },
      },
      lineColor: themeColors.lineColor,
      tickColor: themeColors.tickColor,
    },
    yAxis: {
      title: {
        text: undefined,
      },
      labels: {
        style: {
          color: themeColors.textColor,
        },
        formatter() {
          return formatValue(this.value as number)
        },
      },
      gridLineColor: themeColors.gridLineColor,
      min: 0,
    },
    tooltip: {
      shared: true,
      formatter() {
        const date = new Date(this.x as number)
        const timeStr = `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
        let html = `<b>${timeStr}</b><br/>`

        this.points?.forEach((point) => {
          html += `<span style="color:${point.color}">\u25CF</span> ${point.series.name}: <b>${formatValue(point.y as number, true)}</b><br/>`
        })

        return html
      },
    },
    plotOptions: {
      areaspline: {
        fillOpacity: 0.3,
        marker: {
          enabled: false,
        },
        lineWidth: 2,
        states: {
          hover: {
            lineWidth: 3,
          },
        },
        threshold: null,
      },
    },
    series: props.seriesConfig.map((config, index) => ({
      type: 'areaspline' as const,
      name: config.name,
      color:
        config.color ||
        themeColors.seriesColors[index] ||
        Highcharts.getOptions().colors?.[index] ||
        `hsl(${index * 120}, 70%, 50%)`,
      data: (props.initialData?.[index] || []) as [number, number][],
    })),
  }
}

// Chart ref methods
const chartRef: ChartRef = {
  addPoint: (seriesIndex: number, time: number, value: number) => {
    if (chart?.series[seriesIndex]) {
      const shift = chart.series[seriesIndex].data.length >= CHART_MAX_XAXIS
      chart.series[seriesIndex].addPoint([time, value], true, shift, {
        duration: 800,
        easing: 'linear',
      })
    }
  },
  addPoints: (
    points: { seriesIndex: number; time: number; value: number }[],
  ) => {
    if (!chart) return

    // Group points by series
    const pointsBySeriesMap = new Map<
      number,
      { time: number; value: number }[]
    >()

    points.forEach((p) => {
      if (!pointsBySeriesMap.has(p.seriesIndex)) {
        pointsBySeriesMap.set(p.seriesIndex, [])
      }
      pointsBySeriesMap.get(p.seriesIndex)!.push({
        time: p.time,
        value: p.value,
      })
    })

    // Add points to each series
    pointsBySeriesMap.forEach((seriesPoints, seriesIndex) => {
      const series = chart?.series[seriesIndex]
      if (series) {
        seriesPoints.forEach((point) => {
          const shift = series.data.length >= CHART_MAX_XAXIS
          series.addPoint([point.time, point.value], false, shift)
        })
      }
    })

    // Redraw all at once
    chart.redraw({
      duration: 800,
      easing: 'linear',
    })
  },
  setSeriesData: (seriesIndex: number, data: [number, number][]) => {
    if (chart?.series[seriesIndex]) {
      chart.series[seriesIndex].setData(data, true, false, false)
    }
  },
}

// Expose chartRef
defineExpose({ chartRef })

onMounted(() => {
  if (!containerRef.value) return

  chart = Highcharts.chart(containerRef.value, createChartOptions())

  // Emit chart ready event
  emit('chartReady', chartRef)

  const resizeObserver = new ResizeObserver(() => {
    if (chart && containerRef.value) {
      chart.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
        true,
      )
    }
  })

  resizeObserver.observe(containerRef.value)

  onUnmounted(() => {
    resizeObserver.disconnect()
    chart?.destroy()
  })
})

// Update title when it changes
watch(
  () => props.title,
  (title) => {
    if (chart) {
      chart.setTitle({ text: title })
    }
  },
)

// Update series config when it changes (including colors for theme switching)
watch(
  () => props.seriesConfig,
  (seriesConfig) => {
    if (chart) {
      seriesConfig.forEach((config, index) => {
        if (chart!.series[index]) {
          chart!.series[index].update(
            { type: 'areaspline', name: config.name, color: config.color },
            false,
          )
        }
      })
      chart.redraw()
    }
  },
  { deep: true },
)

// Update theme colors when theme changes
watch(
  () => configStore.curTheme,
  () => {
    // Wait for DOM to update with new theme before getting CSS variables
    requestAnimationFrame(() => {
      if (chart) {
        const themeColors = getChartThemeColors()

        chart.update(
          {
            chart: {
              backgroundColor: themeColors.backgroundColor,
            },
            title: { style: { color: themeColors.textColor } },
            legend: {
              itemStyle: { color: themeColors.textColor },
              itemHoverStyle: { color: themeColors.textColorHover },
            },
            xAxis: {
              labels: { style: { color: themeColors.textColor } },
              lineColor: themeColors.lineColor,
              tickColor: themeColors.tickColor,
            },
            yAxis: {
              labels: { style: { color: themeColors.textColor } },
              gridLineColor: themeColors.gridLineColor,
            },
          },
          true,
          false,
          false,
        )
      }
    })
  },
)
</script>

<template>
  <div class="relative h-full w-full">
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center"
    >
      <span
        class="inline-block h-10 w-10 bg-base-content [mask-size:contain] [mask-position:center] [mask-repeat:no-repeat]"
        :style="{
          maskImage: `url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ccircle cx=%274%27 cy=%2712%27 r=%272%27 fill=%27currentColor%27%3E%3Canimate attributeName=%27opacity%27 dur=%270.75s%27 values=%271;0.5;1%27 repeatCount=%27indefinite%27 begin=%270%27/%3E%3C/circle%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%272%27 fill=%27currentColor%27%3E%3Canimate attributeName=%27opacity%27 dur=%270.75s%27 values=%271;0.5;1%27 repeatCount=%27indefinite%27 begin=%270.15s%27/%3E%3C/circle%3E%3Ccircle cx=%2720%27 cy=%2712%27 r=%272%27 fill=%27currentColor%27%3E%3Canimate attributeName=%27opacity%27 dur=%270.75s%27 values=%271;0.5;1%27 repeatCount=%27indefinite%27 begin=%270.3s%27/%3E%3C/circle%3E%3C/svg%3E')`,
          WebkitMaskImage: `url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Ccircle cx=%274%27 cy=%2712%27 r=%272%27 fill=%27currentColor%27%3E%3Canimate attributeName=%27opacity%27 dur=%270.75s%27 values=%271;0.5;1%27 repeatCount=%27indefinite%27 begin=%270%27/%3E%3C/circle%3E%3Ccircle cx=%2712%27 cy=%2712%27 r=%272%27 fill=%27currentColor%27%3E%3Canimate attributeName=%27opacity%27 dur=%270.75s%27 values=%271;0.5;1%27 repeatCount=%27indefinite%27 begin=%270.15s%27/%3E%3C/circle%3E%3Ccircle cx=%2720%27 cy=%2712%27 r=%272%27 fill=%27currentColor%27%3E%3Canimate attributeName=%27opacity%27 dur=%270.75s%27 values=%271;0.5;1%27 repeatCount=%27indefinite%27 begin=%270.3s%27/%3E%3C/circle%3E%3C/svg%3E')`,
        }"
      />
    </div>
    <div
      ref="containerRef"
      class="h-full w-full transition-opacity duration-200 ease-in-out"
      :class="{ 'opacity-0': isLoading }"
    />
  </div>
</template>
