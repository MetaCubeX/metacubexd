import { describe, expect, it } from 'vitest'
import { pickFreePorts } from '../free-port'

describe('pickFreePorts', () => {
  it('returns the first N ports the probe reports free', async () => {
    const free = new Set([20002, 20005])
    const probe = async (p: number) => free.has(p)
    const ports = await pickFreePorts(2, { start: 20000, probe })
    expect(ports).toEqual([20002, 20005])
  })

  it('never returns the same port twice even if the probe says free', async () => {
    const probe = async () => true // every port "free"
    const ports = await pickFreePorts(2, { start: 30000, probe })
    expect(ports).toEqual([30000, 30001])
    expect(new Set(ports).size).toBe(2)
  })

  it('throws if it cannot find enough free ports within the scan window', async () => {
    const probe = async () => false // nothing free
    await expect(
      pickFreePorts(1, { start: 40000, probe, maxScan: 5 }),
    ).rejects.toThrow('no free port')
  })
})
