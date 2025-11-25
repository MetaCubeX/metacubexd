import Highcharts from 'highcharts'
import type { Component } from 'solid-js'
import { getChartThemeColors } from '~/helpers'
import { curTheme } from '~/signals'

export type HighchartsAutoSizeProps = {
  options: Highcharts.Options
  isLoading?: boolean
}

export const HighchartsAutoSize: Component<HighchartsAutoSizeProps> = (
  props,
) => {
  let containerRef: HTMLDivElement | undefined
  let chart: Highcharts.Chart | undefined

  const getDefaultOptions = (): Highcharts.Options => {
    const themeColors = getChartThemeColors()

    return {
      chart: {
        animation: {
          duration: 300,
        },
        backgroundColor: themeColors.backgroundColor,
      },
      credits: {
        enabled: false,
      },
      legend: {
        itemStyle: {
          color: themeColors.textColor,
        },
        itemHoverStyle: {
          color: themeColors.textColorHover,
        },
      },
      title: {
        style: {
          color: themeColors.textColor,
        },
      },
    }
  }

  onMount(() => {
    if (!containerRef) return

    const defaultOptions = getDefaultOptions()
    const mergedOptions = {
      ...defaultOptions,
      ...props.options,
      chart: {
        ...defaultOptions.chart,
        ...props.options.chart,
      },
    }

    chart = Highcharts.chart(containerRef, mergedOptions)

    // Track previous dimensions to avoid unnecessary resize
    let lastWidth = containerRef.clientWidth
    let lastHeight = containerRef.clientHeight

    const resizeObserver = new ResizeObserver(() => {
      if (chart && containerRef) {
        const newWidth = containerRef.clientWidth
        const newHeight = containerRef.clientHeight

        // Only call setSize when dimensions actually change
        if (newWidth !== lastWidth || newHeight !== lastHeight) {
          lastWidth = newWidth
          lastHeight = newHeight
          chart.setSize(newWidth, newHeight, false)
        }
      }
    })

    resizeObserver.observe(containerRef)

    onCleanup(() => {
      resizeObserver.disconnect()
      chart?.destroy()
    })
  })

  createEffect(() => {
    const options = props.options

    if (chart) {
      // Only update series data, don't recreate the entire chart
      chart.update(options, true, false, false)
    }
  })

  // Update theme colors when theme changes
  createEffect(() => {
    curTheme() // Track theme changes

    // Wait for DOM to update with new theme before getting CSS variables
    requestAnimationFrame(() => {
      if (chart) {
        const themeColors = getChartThemeColors()

        chart.update(
          {
            title: { style: { color: themeColors.textColor } },
            legend: {
              itemStyle: { color: themeColors.textColor },
              itemHoverStyle: { color: themeColors.textColorHover },
            },
          },
          true,
          false,
          false,
        )
      }
    })
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
