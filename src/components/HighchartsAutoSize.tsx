import Highcharts from 'highcharts'
import type { Component } from 'solid-js'

export type HighchartsAutoSizeProps = {
  options: Highcharts.Options
  isLoading?: boolean
}

export const HighchartsAutoSize: Component<HighchartsAutoSizeProps> = (
  props,
) => {
  let containerRef: HTMLDivElement | undefined
  let chart: Highcharts.Chart | undefined

  const defaultOptions: Highcharts.Options = {
    chart: {
      animation: {
        duration: 300,
      },
      backgroundColor: 'transparent',
    },
    credits: {
      enabled: false,
    },
    legend: {
      itemStyle: {
        color: 'oklch(0.746477 0 0)',
      },
      itemHoverStyle: {
        color: 'oklch(0.9 0 0)',
      },
    },
    title: {
      style: {
        color: 'oklch(0.746477 0 0)',
      },
    },
  }

  onMount(() => {
    if (!containerRef) return

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
