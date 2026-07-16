// Test setup file for Vitest
// Configures global mocks for browser APIs and Nuxt auto-imports

import { useLocalStorage, useSessionStorage } from '@vueuse/core'
import { beforeEach, vi } from 'vitest'
import {
  computed,
  effectScope,
  markRaw,
  reactive,
  ref,
  shallowRef,
  toRef,
  toValue,
  watch,
  watchEffect,
} from 'vue'

// Provide Vue and VueUse auto-imports globally (Nuxt auto-import simulation)
vi.stubGlobal('ref', ref)
vi.stubGlobal('shallowRef', shallowRef)
vi.stubGlobal('markRaw', markRaw)
vi.stubGlobal('computed', computed)
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('toRef', toRef)
vi.stubGlobal('watch', watch)
vi.stubGlobal('watchEffect', watchEffect)
vi.stubGlobal('effectScope', effectScope)
vi.stubGlobal('toValue', toValue)
vi.stubGlobal('useLocalStorage', useLocalStorage)
vi.stubGlobal('useSessionStorage', useSessionStorage)
vi.stubGlobal('useRuntimeConfig', () => ({
  public: {
    appVersion: '0.0.0',
    defaultBackendURL: '',
    githubToken: '',
    mockMode: false,
  },
}))

function createStorageMock() {
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
}

// Mock localStorage and sessionStorage independently
const localStorageMock = createStorageMock()
const sessionStorageMock = createStorageMock()

vi.stubGlobal('localStorage', localStorageMock)
vi.stubGlobal('sessionStorage', sessionStorageMock)

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

// Minimal EventSource mock for SSE log-stream tests. Specs that need to drive
// events grab the latest instance via (globalThis as any).__lastEventSource.
class MockEventSource {
  url: string
  readyState = 0
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  onopen: ((ev: unknown) => void) | null = null
  close = vi.fn(() => {
    this.readyState = 2
  })
  constructor(url: string) {
    this.url = url
    this.readyState = 1
    ;(globalThis as any).__lastEventSource = this
  }

  // Test helper: simulate a server-sent frame.
  emit(data: string) {
    this.onmessage?.({ data })
  }
}
vi.stubGlobal('EventSource', MockEventSource)

// Nuxt auto-import stubs used by plugins under test.
vi.stubGlobal('defineNuxtPlugin', (fn: any) => fn)

// @nuxtjs/i18n auto-imports useI18n() globally. Composables under test call it
// unqualified; return the key (and named params) so assertions stay stable.
vi.stubGlobal('useI18n', () => ({
  t: (key: string) => key,
}))

// Defensive stub for the onboarding shared-state composable. No component-mount
// spec uses it today, but stubbing it shields any future overview/proxies/
// profiles component spec from the "useProfileStatus is not defined" auto-import
// failure mode. The composable's OWN unit test bypasses this via vi.resetModules
// + dynamic import of the real module.
vi.stubGlobal('useProfileStatus', () => ({
  ready: ref(true),
  hasBaseProfile: computed(() => false),
  baseProfileCount: ref(0),
  refresh: vi.fn(),
}))

// Reset storage before each test
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
