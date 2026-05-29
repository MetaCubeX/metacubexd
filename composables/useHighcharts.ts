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
      // v12 removed useUTC; local timezone is the default. Apply once here
      // instead of repeating it in every chart component.
      hc.setOptions({ time: {} })
      return hc
    })
  }

  return highchartsPromise
}
