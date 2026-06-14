import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfigStore } from '../config'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

describe('connections display mode migration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
  })

  it('defaults to auto when no legacy or new key is present', () => {
    const store = useConfigStore()
    expect(store.connectionsDisplayMode).toBe('auto')
  })

  it('migrates legacy useMobileConnectionsTable=true to table', () => {
    localStorage.setItem('useMobileConnectionsTable', 'true')

    const store = useConfigStore()

    expect(store.connectionsDisplayMode).toBe('table')
    expect(localStorage.getItem('useMobileConnectionsTable')).toBeNull()
  })

  it('migrates legacy useMobileConnectionsTable=false to auto', () => {
    localStorage.setItem('useMobileConnectionsTable', 'false')

    const store = useConfigStore()

    expect(store.connectionsDisplayMode).toBe('auto')
    expect(localStorage.getItem('useMobileConnectionsTable')).toBeNull()
  })

  it('preserves an already-set new key over a legacy key (new wins)', () => {
    // VueUse's default string serializer is identity (no JSON encoding),
    // so the stored value is the raw string, not JSON-quoted.
    localStorage.setItem('connectionsDisplayMode', 'card')
    localStorage.setItem('useMobileConnectionsTable', 'true')

    const store = useConfigStore()

    expect(store.connectionsDisplayMode).toBe('card')
  })
})
