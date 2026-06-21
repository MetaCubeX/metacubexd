import { describe, expect, it } from 'vitest'
import { computeLatencyTrend, svgPathFromPoints } from '../latencyTrend'

const at = (delay: number) => ({ time: '2026-06-21T00:00:00.000Z', delay })

describe('computeLatencyTrend', () => {
  it('returns null for empty history', () => {
    expect(computeLatencyTrend([])).toBeNull()
  })

  it('returns null with fewer than two successful readings', () => {
    expect(computeLatencyTrend([at(0), at(100)])).toBeNull()
  })

  it('computes stats over successful readings only, success rate over all', () => {
    const trend = computeLatencyTrend([at(100), at(200), at(0)])
    expect(trend).not.toBeNull()
    expect(trend!.min).toBe(100)
    expect(trend!.max).toBe(200)
    expect(trend!.avg).toBe(150)
    expect(trend!.jitter).toBe(50)
    expect(trend!.successTests).toBe(2)
    expect(trend!.totalTests).toBe(3)
    expect(trend!.successRate).toBe(67)
    expect(trend!.points).toHaveLength(2)
  })

  it('maps points into the 0..100 / 5..45 SVG space', () => {
    const { points } = computeLatencyTrend([at(100), at(200)])!
    expect(points[0]).toEqual({ x: 0, y: 45 })
    expect(points[1]).toEqual({ x: 100, y: 5 })
  })
})

describe('svgPathFromPoints', () => {
  it('builds an M/L path string', () => {
    expect(
      svgPathFromPoints([
        { x: 0, y: 45 },
        { x: 100, y: 5 },
      ]),
    ).toBe('M 0 45 L 100 5')
  })
})
