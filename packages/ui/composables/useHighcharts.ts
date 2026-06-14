import type Highcharts from 'highcharts'

// Highcharts is a large dependency (hundreds of KB). Importing it statically
// pulls it into the initial bundle even though charts only render once the app
// is interactive — and one of its consumers (GlobalTrafficIndicator) is mounted
// on every page. This lazy loader code-splits Highcharts into its own chunk
// fetched on first chart mount, shrinking the first-paint payload.
let highchartsPromise: Promise<typeof Highcharts> | null = null

export function loadHighcharts(): Promise<typeof Highcharts> {
  if (!highchartsPromise) {
    highchartsPromise = import('highcharts').then((module) => {
      const hc = module.default
      // v12 defaults to timezone: 'UTC'. Explicitly set to undefined so
      // Intl.DateTimeFormat falls back to the browser's local timezone.
      hc.setOptions({ time: { timezone: undefined } })
      return hc
    })
  }

  return highchartsPromise
}
