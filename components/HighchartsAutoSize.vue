<script setup lang="ts">
import Highcharts from 'highcharts'
import { getChartThemeColors } from '~/utils'

interface Props {
  options: Highcharts.Options
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const containerRef = ref<HTMLDivElement>()
let chart: Highcharts.Chart | undefined

const configStore = useConfigStore()

function getDefaultOptions(): Highcharts.Options {
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
    accessibility: {
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

onMounted(() => {
  if (!containerRef.value) return

  const defaultOptions = getDefaultOptions()
  const mergedOptions = {
    ...defaultOptions,
    ...props.options,
    chart: {
      ...defaultOptions.chart,
      ...props.options.chart,
    },
  }

  chart = Highcharts.chart(containerRef.value, mergedOptions)

  // Track previous dimensions to avoid unnecessary resize
  let lastWidth = containerRef.value.clientWidth
  let lastHeight = containerRef.value.clientHeight

  const resizeObserver = new ResizeObserver(() => {
    if (chart && containerRef.value) {
      const newWidth = containerRef.value.clientWidth
      const newHeight = containerRef.value.clientHeight

      // Only call setSize when dimensions actually change
      if (newWidth !== lastWidth || newHeight !== lastHeight) {
        lastWidth = newWidth
        lastHeight = newHeight
        chart.setSize(newWidth, newHeight, false)
      }
    }
  })

  resizeObserver.observe(containerRef.value)

  onUnmounted(() => {
    resizeObserver.disconnect()
    chart?.destroy()
  })
})

// Update chart when options change
watch(
  () => props.options,
  (options) => {
    if (chart) {
      // Only update series data, don't recreate the entire chart
      chart.update(options, true, false, false)
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
        class="inline-block size-10 bg-base-content [mask-image:url(&quot;data:image/svg+xml,%3Csvg_xmlns='http://www.w3.org/2000/svg'_viewBox='0_0_24_24'%3E%3Ccircle_cx='4'_cy='12'_r='2'_fill='currentColor'%3E%3Canimate_attributeName='opacity'_dur='0.75s'_values='1;0.5;1'_repeatCount='indefinite'_begin='0'/%3E%3C/circle%3E%3Ccircle_cx='12'_cy='12'_r='2'_fill='currentColor'%3E%3Canimate_attributeName='opacity'_dur='0.75s'_values='1;0.5;1'_repeatCount='indefinite'_begin='0.15s'/%3E%3C/circle%3E%3Ccircle_cx='20'_cy='12'_r='2'_fill='currentColor'%3E%3Canimate_attributeName='opacity'_dur='0.75s'_values='1;0.5;1'_repeatCount='indefinite'_begin='0.3s'/%3E%3C/circle%3E%3C/svg%3E&quot;)] [mask-size:contain] [mask-position:center] [mask-repeat:no-repeat]"
      />
    </div>
    <div
      ref="containerRef"
      class="h-full w-full transition-opacity duration-200 ease-in-out"
      :class="{ 'opacity-0': isLoading }"
    />
  </div>
</template>
