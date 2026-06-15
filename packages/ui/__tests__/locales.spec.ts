import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const localesDir = resolve(process.cwd(), 'i18n/locales')

// Locales that must have full key parity with the canonical en.json source.
// en is the source of truth; these locales translate the exact same key set
// (missing keys fall back at runtime, but parity is required here).
//
// ru.json is intentionally excluded from the strict-parity set: it predates
// several feature keys (recommendation.*, shortcuts.*, connectionError, retry…)
// and back-filling its Russian translations is out of this task's scope. It is
// still covered by the valid-JSON check below so it can't silently break.
const PARITY_LOCALES = ['zh', 'ja', 'ko', 'fr', 'fa'] as const
const ALL_LOCALES = ['zh', 'ru', 'ja', 'ko', 'fr', 'fa'] as const

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

const readLocale = (code: string): Record<string, JsonValue> => {
  const raw = readFileSync(resolve(localesDir, `${code}.json`), 'utf8')
  return JSON.parse(raw) as Record<string, JsonValue>
}

const flattenKeys = (obj: Record<string, JsonValue>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix + key
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? flattenKeys(value as Record<string, JsonValue>, `${path  }.`)
      : [path]
  })

describe('i18n locales', () => {
  const enKeys = flattenKeys(readLocale('en')).sort()

  it('has a non-empty en source key set', () => {
    expect(enKeys.length).toBeGreaterThan(0)
  })

  // Every shipped locale must at least be valid JSON.
  for (const code of ALL_LOCALES) {
    it(`${code}.json is valid JSON`, () => {
      expect(() => readLocale(code)).not.toThrow()
    })
  }

  // The new desktop locales (and zh) must mirror en.json key-for-key.
  for (const code of PARITY_LOCALES) {
    it(`${code}.json has exact key parity with en.json`, () => {
      const keys = flattenKeys(readLocale(code)).sort()
      expect(keys).toEqual(enKeys)
    })
  }
})
