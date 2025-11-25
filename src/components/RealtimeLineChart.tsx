import byteSize from 'byte-size'
import Highcharts from 'highcharts'
import type { Component } from 'solid-js'
import { CHART_MAX_XAXIS } from '~/constants'

export type RealtimeLineChartProps = {
  title: string
  seriesConfig: {
    name: string
    color?: string
  }[]
  isLoading?: boolean
}

export const RealtimeLineChart: Component<RealtimeLineChartProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let chart: Highcharts.Chart | undefined

  const createChartOptions = (): Highcharts.Options => ({
    chart: {
      type: 'areaspline',
      animation: {
        duration: 800,
        easing: 'linear',
      },
      backgroundColor: 'transparent',
    },
    credits: {
      enabled: false,
    },
    title: {
      text: props.title,
      style: {
        color: 'oklch(0.746477 0 0)',
      },
    },
    legend: {
      enabled: true,
      itemStyle: {
        color: 'oklch(0.746477 0 0)',
      },
      itemHoverStyle: {
        color: 'oklch(0.9 0 0)',
      },
    },
    xAxis: {
      type: 'datetime',
      tickPixelInterval: 100,
      labels: {
        style: {
          color: 'oklch(0.746477 0 0)',
        },
        formatter: function () {
          const date = new Date(this.value as number)

          return `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
        },
      },
      lineColor: 'oklch(0.3 0 0)',
      tickColor: 'oklch(0.3 0 0)',
    },
    yAxis: {
      title: {
        text: undefined,
      },
      labels: {
        style: {
          color: 'oklch(0.746477 0 0)',
        },
        formatter: function () {
          return byteSize(this.value as number).toString()
        },
      },
      gridLineColor: 'oklch(0.3 0 0)',
      min: 0,
    },
    tooltip: {
      shared: true,
      formatter: function () {
        const date = new Date(this.x as number)
        const timeStr = `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
        let html = `<b>${timeStr}</b><br/>`

        this.points?.forEach((point) => {
          html += `<span style="color:${point.color}">\u25CF</span> ${point.series.name}: <b>${byteSize(point.y as number).toString()}/s</b><br/>`
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
        Highcharts.getOptions().colors?.[index] ||
        `hsl(${index * 120}, 70%, 50%)`,
      data: [] as [number, number][],
    })),
  })

  onMount(() => {
    if (!containerRef) return

    chart = Highcharts.chart(containerRef, createChartOptions())

    const resizeObserver = new ResizeObserver(() => {
      if (chart && containerRef) {
        chart.setSize(containerRef.clientWidth, containerRef.clientHeight, true)
      }
    })

    resizeObserver.observe(containerRef)

    onCleanup(() => {
      resizeObserver.disconnect()
      chart?.destroy()
    })
  })

  // Update title
  createEffect(() => {
    const title = props.title

    if (chart) {
      chart.setTitle({ text: title })
    }
  })

  // Update series config
  createEffect(() => {
    const seriesConfig = props.seriesConfig

    if (chart) {
      // Update series names
      seriesConfig.forEach((config, index) => {
        if (chart!.series[index]) {
          chart!.series[index].update(
            { type: 'areaspline', name: config.name },
            false,
          )
        }
      })

      chart.redraw()
    }
  })

  return (
    <div class="relative h-full w-full">
      <Show when={props.isLoading}>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="loading loading-lg loading-dots" />
        </div>
      </Show>
      <div
        ref={containerRef}
        class="h-full w-full"
        classList={{ 'opacity-0': props.isLoading }}
      />
    </div>
  )
}

// Create a ref to control chart updates
export type RealtimeChartRef = {
  addPoint: (seriesIndex: number, time: number, value: number) => void
  addPoints: (
    points: { seriesIndex: number; time: number; value: number }[],
  ) => void
}

export type RealtimeLineChartWithRefProps = RealtimeLineChartProps & {
  ref?: (ref: RealtimeChartRef) => void
}

export const RealtimeLineChartWithRef: Component<
  RealtimeLineChartWithRefProps
> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let chart: Highcharts.Chart | undefined

  const createChartOptions = (): Highcharts.Options => ({
    chart: {
      type: 'areaspline',
      animation: {
        duration: 800,
        easing: 'linear',
      },
      backgroundColor: 'transparent',
    },
    credits: {
      enabled: false,
    },
    title: {
      text: props.title,
      style: {
        color: 'oklch(0.746477 0 0)',
      },
    },
    legend: {
      enabled: true,
      itemStyle: {
        color: 'oklch(0.746477 0 0)',
      },
      itemHoverStyle: {
        color: 'oklch(0.9 0 0)',
      },
    },
    xAxis: {
      type: 'datetime',
      tickPixelInterval: 100,
      labels: {
        style: {
          color: 'oklch(0.746477 0 0)',
        },
        formatter: function () {
          const date = new Date(this.value as number)

          return `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
        },
      },
      lineColor: 'oklch(0.3 0 0)',
      tickColor: 'oklch(0.3 0 0)',
    },
    yAxis: {
      title: {
        text: undefined,
      },
      labels: {
        style: {
          color: 'oklch(0.746477 0 0)',
        },
        formatter: function () {
          return byteSize(this.value as number).toString()
        },
      },
      gridLineColor: 'oklch(0.3 0 0)',
      min: 0,
    },
    tooltip: {
      shared: true,
      formatter: function () {
        const date = new Date(this.x as number)
        const timeStr = `${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
        let html = `<b>${timeStr}</b><br/>`

        this.points?.forEach((point) => {
          html += `<span style="color:${point.color}">\u25CF</span> ${point.series.name}: <b>${byteSize(point.y as number).toString()}/s</b><br/>`
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
        Highcharts.getOptions().colors?.[index] ||
        `hsl(${index * 120}, 70%, 50%)`,
      data: [] as [number, number][],
    })),
  })

  onMount(() => {
    if (!containerRef) return

    chart = Highcharts.chart(containerRef, createChartOptions())

    // Provide ref interface
    props.ref?.({
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
          if (chart?.series[seriesIndex]) {
            seriesPoints.forEach((point) => {
              const shift =
                chart!.series[seriesIndex].data.length >= CHART_MAX_XAXIS

              chart!.series[seriesIndex].addPoint(
                [point.time, point.value],
                false,
                shift,
              )
            })
          }
        })

        // Redraw all at once
        chart.redraw({
          duration: 800,
          easing: 'linear',
        })
      },
    })

    const resizeObserver = new ResizeObserver(() => {
      if (chart && containerRef) {
        chart.setSize(containerRef.clientWidth, containerRef.clientHeight, true)
      }
    })

    resizeObserver.observe(containerRef)

    onCleanup(() => {
      resizeObserver.disconnect()
      chart?.destroy()
    })
  })

  // Update title
  createEffect(() => {
    const title = props.title

    if (chart) {
      chart.setTitle({ text: title })
    }
  })

  // Update series config
  createEffect(() => {
    const seriesConfig = props.seriesConfig

    if (chart) {
      seriesConfig.forEach((config, index) => {
        if (chart!.series[index]) {
          chart!.series[index].update(
            { type: 'areaspline', name: config.name },
            false,
          )
        }
      })

      chart.redraw()
    }
  })

  return (
    <div class="relative h-full w-full">
      <Show when={props.isLoading}>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="loading loading-lg loading-dots" />
        </div>
      </Show>
      <div
        ref={containerRef}
        class="h-full w-full"
        classList={{ 'opacity-0': props.isLoading }}
      />
    </div>
  )
}
