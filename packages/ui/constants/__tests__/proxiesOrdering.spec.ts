import { describe, expect, it } from 'vitest'
import { PROXIES_ORDERING_TYPE, PROXIES_ORDERING_TYPE_ORDER } from '../index'

describe('pROXIES_ORDERING_TYPE_ORDER', () => {
  it('lists every ordering once, no duplicates/omissions', () => {
    expect(PROXIES_ORDERING_TYPE_ORDER).toEqual([
      PROXIES_ORDERING_TYPE.NATURAL,
      PROXIES_ORDERING_TYPE.LATENCY_ASC,
      PROXIES_ORDERING_TYPE.LATENCY_DESC,
      PROXIES_ORDERING_TYPE.QUALITY_ASC,
      PROXIES_ORDERING_TYPE.QUALITY_DESC,
      PROXIES_ORDERING_TYPE.NAME_ASC,
      PROXIES_ORDERING_TYPE.NAME_DESC,
    ])
    const unique = new Set(PROXIES_ORDERING_TYPE_ORDER)
    expect(unique.size).toBe(Object.values(PROXIES_ORDERING_TYPE).length)
  })
})
