import { schemaSections } from '@metacubexd/config-editor'
import { describe, expect, it } from 'vitest'
import {
  configGeneralKeys,
  configSectionSchema,
  resolveConfigSchema,
} from '../configSchema'

describe('config schema adapter', () => {
  it('resolves allOf and references for global fields', () => {
    const keys = configGeneralKeys()
    expect(keys).toContain('mixed-port')
    expect(keys).toContain('allow-lan')
    expect(keys).toContain('external-controller')
  })

  it('exposes every schema-backed editor section', () => {
    for (const section of schemaSections) {
      expect(Object.keys(configSectionSchema(section)).length).toBeGreaterThan(
        0,
      )
    }
  })

  it('selects a matching anyOf branch', () => {
    expect(
      resolveConfigSchema(
        { anyOf: [{ type: 'integer' }, { type: 'string' }] },
        'value',
      ).type,
    ).toBe('string')
  })

  it('selects discriminated and conditional object fields', () => {
    expect(
      resolveConfigSchema(
        {
          type: 'object',
          oneOf: [
            { properties: { type: { const: 'first' }, first: {} } },
            { properties: { type: { const: 'second' }, second: {} } },
          ],
          if: { properties: { enabled: { const: true } } },
          then: { properties: { active: {} } },
          else: { properties: { inactive: {} } },
        },
        { type: 'second', enabled: true },
      ).properties,
    ).toMatchObject({ second: {}, active: {} })
  })
})
