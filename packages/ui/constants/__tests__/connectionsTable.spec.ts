import { describe, expect, it } from 'vitest'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
} from '../index'

describe('connections table accessor key enum', () => {
  it('exposes the 4 new composite column keys', () => {
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.HostProcess).toBe('hostProcess')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.RuleChains).toBe('ruleChains')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Traffic).toBe('traffic')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Flow).toBe('flow')
  })

  it('preserves all existing atomic column keys', () => {
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Host).toBe('host')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Process).toBe('process')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Rule).toBe('rule')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Chains).toBe('chains')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed).toBe('dlSpeed')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed).toBe('ulSpeed')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP).toBe('sourceIP')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Destination).toBe('destination')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime).toBe('connectTime')
  })
})

describe('connections table initial column visibility', () => {
  const v = CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY

  it('enables the 6 default composite columns', () => {
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Close]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Details]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.HostProcess]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.RuleChains]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Traffic]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Flow]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime]).toBe(true)
  })

  it('disables atomic columns superseded by composite columns', () => {
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Host]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Process]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Rule]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Chains]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP]).toBe(false)
  })
})
