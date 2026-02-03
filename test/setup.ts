// Test setup file for Vitest
// Configures global mocks for browser APIs and Nuxt auto-imports

import { useLocalStorage, useSessionStorage } from '@vueuse/core'
import { beforeEach, vi } from 'vitest'
import { computed, reactive, ref, watch, watchEffect } from 'vue'

// Provide Vue and VueUse auto-imports globally (Nuxt auto-import simulation)
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('watch', watch)
vi.stubGlobal('watchEffect', watchEffect)
vi.stubGlobal('useLocalStorage', useLocalStorage)
vi.stubGlobal('useSessionStorage', useSessionStorage)

// Mock localStorage
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
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

// Mock sessionStorage
vi.stubGlobal('sessionStorage', localStorageMock)

// Mock window.matchMedia
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

// Reset localStorage before each test
beforeEach(() => {
  localStorage.clear()
})
