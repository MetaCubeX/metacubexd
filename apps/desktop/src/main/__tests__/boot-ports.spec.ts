import { describe, expect, it } from 'vitest'
import { resolveBootPorts } from '../boot-ports'

describe('resolveBootPorts', () => {
  it('destructures three distinct ports into named roles', () => {
    const { controlPort, clashPort, mixedPort } = resolveBootPorts([
      21000, 21001, 21002,
    ])
    expect(controlPort).toBe(21000)
    expect(clashPort).toBe(21001)
    expect(mixedPort).toBe(21002)
  })

  it('exposes a numeric mixedPort distinct from controlPort/clashPort', () => {
    const { controlPort, clashPort, mixedPort } = resolveBootPorts([
      30000, 30005, 30009,
    ])
    expect(typeof mixedPort).toBe('number')
    expect(new Set([controlPort, clashPort, mixedPort]).size).toBe(3)
  })

  it('throws when fewer than three ports are provided', () => {
    expect(() => resolveBootPorts([1, 2])).toThrow('three ports')
  })
})
