import { describe, expect, it } from 'vitest'
import {
  calculateLatencyScore,
  calculateNodeScore,
  calculateStabilityScore,
  calculateSuccessRateScore,
  formatTimeSince,
  getScoreBgClass,
  getScoreColorClass,
  SCORE_THRESHOLDS,
} from '../nodeScoring'

describe('nodeScoring', () => {
  describe('calculateLatencyScore', () => {
    it('returns 100 for latency <= 50ms', () => {
      expect(calculateLatencyScore([30])).toBe(100)
      expect(calculateLatencyScore([50])).toBe(100)
    })

    it('returns 0 for latency >= 5000ms', () => {
      expect(calculateLatencyScore([5000])).toBe(0)
      expect(calculateLatencyScore([10000])).toBe(0)
    })

    it('returns ~50 for latency around 500ms', () => {
      const score = calculateLatencyScore([500])
      expect(score).toBeGreaterThan(40)
      expect(score).toBeLessThan(60)
    })

    it('returns 0 for empty array', () => {
      expect(calculateLatencyScore([])).toBe(0)
    })

    it('filters out null values', () => {
      expect(calculateLatencyScore([null, 50, null])).toBe(100)
    })

    it('calculates average for multiple values', () => {
      const score = calculateLatencyScore([50, 50, 50])
      expect(score).toBe(100)
    })
  })

  describe('calculateStabilityScore', () => {
    it('returns 50 for less than 2 data points', () => {
      expect(calculateStabilityScore([100])).toBe(50)
      expect(calculateStabilityScore([])).toBe(50)
    })

    it('returns 100 for very stable latencies (low CV)', () => {
      // All same values = CV of 0
      expect(calculateStabilityScore([100, 100, 100, 100])).toBe(100)
    })

    it('returns 0 for highly variable latencies (high CV)', () => {
      // Very high variation
      expect(calculateStabilityScore([100, 1000, 50, 2000])).toBe(0)
    })

    it('filters out null values', () => {
      expect(calculateStabilityScore([null, 100, 100, null])).toBe(100)
    })
  })

  describe('calculateSuccessRateScore', () => {
    it('returns 0 for empty history', () => {
      expect(calculateSuccessRateScore([])).toBe(0)
    })

    it('returns 100 for all successful', () => {
      expect(
        calculateSuccessRateScore([
          { success: true },
          { success: true },
          { success: true },
        ]),
      ).toBe(100)
    })

    it('returns 0 for all failed', () => {
      expect(
        calculateSuccessRateScore([{ success: false }, { success: false }]),
      ).toBe(0)
    })

    it('returns correct percentage', () => {
      expect(
        calculateSuccessRateScore([{ success: true }, { success: false }]),
      ).toBe(50)
    })
  })

  describe('calculateNodeScore', () => {
    it('returns 0 for empty history', () => {
      const data = {
        nodeName: 'test',
        history: [],
        lastTestTime: Date.now(),
        score: null,
      }
      expect(calculateNodeScore(data)).toBe(0)
    })

    it('calculates weighted score correctly', () => {
      const data = {
        nodeName: 'test',
        history: [
          { timestamp: Date.now(), latency: 50, success: true },
          { timestamp: Date.now(), latency: 50, success: true },
        ],
        lastTestTime: Date.now(),
        score: null,
      }
      // With low latency, stable, 100% success, should be high score
      const score = calculateNodeScore(data)
      expect(score).toBeGreaterThan(80)
    })

    it('respects custom weights', () => {
      const data = {
        nodeName: 'test',
        history: [
          { timestamp: Date.now(), latency: 50, success: true },
          { timestamp: Date.now(), latency: 50, success: true },
        ],
        lastTestTime: Date.now(),
        score: null,
      }
      const weights = { latency: 100, stability: 0, successRate: 0 }
      const score = calculateNodeScore(data, weights)
      expect(score).toBe(100) // Only latency matters, and it's perfect
    })
  })

  describe('getScoreColorClass', () => {
    it('returns text-success for score >= 80', () => {
      expect(getScoreColorClass(80)).toBe('text-success')
      expect(getScoreColorClass(100)).toBe('text-success')
    })

    it('returns text-warning for score >= 50 and < 80', () => {
      expect(getScoreColorClass(50)).toBe('text-warning')
      expect(getScoreColorClass(79)).toBe('text-warning')
    })

    it('returns text-error for score < 50', () => {
      expect(getScoreColorClass(49)).toBe('text-error')
      expect(getScoreColorClass(0)).toBe('text-error')
    })
  })

  describe('getScoreBgClass', () => {
    it('returns bg-success/20 for score >= 80', () => {
      expect(getScoreBgClass(80)).toBe('bg-success/20')
    })

    it('returns bg-warning/20 for score >= 50 and < 80', () => {
      expect(getScoreBgClass(50)).toBe('bg-warning/20')
    })

    it('returns bg-error/20 for score < 50', () => {
      expect(getScoreBgClass(49)).toBe('bg-error/20')
    })
  })

  describe('formatTimeSince', () => {
    it('formats seconds correctly', () => {
      const now = Date.now()
      expect(formatTimeSince(now - 30000)).toBe('30s ago')
    })

    it('formats minutes correctly', () => {
      const now = Date.now()
      expect(formatTimeSince(now - 120000)).toBe('2m ago')
    })

    it('formats hours correctly', () => {
      const now = Date.now()
      expect(formatTimeSince(now - 7200000)).toBe('2h ago')
    })

    it('formats days correctly', () => {
      const now = Date.now()
      expect(formatTimeSince(now - 172800000)).toBe('2d ago')
    })
  })

  describe('sCORE_THRESHOLDS', () => {
    it('has correct threshold values', () => {
      expect(SCORE_THRESHOLDS.good).toBe(80)
      expect(SCORE_THRESHOLDS.medium).toBe(50)
    })
  })
})
