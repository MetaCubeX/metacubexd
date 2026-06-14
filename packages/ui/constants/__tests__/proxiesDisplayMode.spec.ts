import { describe, expect, it } from 'vitest'
import { PROXIES_DISPLAY_MODE, PROXIES_DISPLAY_MODE_ORDER } from '../index'

describe('pROXIES_DISPLAY_MODE enum', () => {
  it('keeps existing card/list values', () => {
    expect(PROXIES_DISPLAY_MODE.CARD).toBe('cardMode')
    expect(PROXIES_DISPLAY_MODE.LIST).toBe('listMode')
  })

  it('adds table/chips/master values', () => {
    expect(PROXIES_DISPLAY_MODE.TABLE).toBe('tableMode')
    expect(PROXIES_DISPLAY_MODE.CHIPS).toBe('chipsMode')
    expect(PROXIES_DISPLAY_MODE.MASTER).toBe('masterDetailMode')
  })
})

describe('pROXIES_DISPLAY_MODE_ORDER', () => {
  it('lists all 5 modes in switcher order with no duplicates/omissions', () => {
    expect(PROXIES_DISPLAY_MODE_ORDER).toEqual([
      PROXIES_DISPLAY_MODE.CARD,
      PROXIES_DISPLAY_MODE.LIST,
      PROXIES_DISPLAY_MODE.TABLE,
      PROXIES_DISPLAY_MODE.CHIPS,
      PROXIES_DISPLAY_MODE.MASTER,
    ])
    const unique = new Set(PROXIES_DISPLAY_MODE_ORDER)
    expect(unique.size).toBe(Object.values(PROXIES_DISPLAY_MODE).length)
  })
})
