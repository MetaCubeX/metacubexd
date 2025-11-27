// Mock mode utilities
export const isMockMode = () => import.meta.env.VITE_MOCK_MODE === 'true'

// Mock handler registry
const mockHandlers = new Map<string, () => unknown>()

/**
 * Register a mock handler for an API path
 */
export const registerMock = <T>(path: string, handler: () => T) => {
  mockHandlers.set(path, handler)
}

/**
 * Get mock data for a given path
 */
export const getMockData = (path: string): unknown => {
  // Try exact match first
  if (mockHandlers.has(path)) {
    return mockHandlers.get(path)!()
  }

  // Try partial match (for paths like 'proxies/xxx/delay')
  for (const [key, handler] of mockHandlers) {
    if (path.includes(key)) {
      return handler()
    }
  }

  return { message: 'OK' }
}

/**
 * Check if mock handler exists for a path
 */
export const hasMock = (path: string): boolean => {
  if (mockHandlers.has(path)) return true

  for (const key of mockHandlers.keys()) {
    if (path.includes(key)) return true
  }

  return false
}
