// packages/ui/composables/__tests__/useRuleEditor.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRuleEditor } from '../useRuleEditor'

const api = {
  getConfigSection: vi.fn(),
  setConfigSection: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

// hasFeature is driven by the gating probe; toggle it per test.
let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (f: string) => featurePresent && f === 'config-sections',
  }),
}))

// Errors surface via toast (never swallowed).
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))

describe('composables/useRuleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    api.getConfigSection.mockResolvedValue([
      'DOMAIN-SUFFIX,google.com,PROXY',
      'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
      'MATCH,DIRECT',
    ])
    api.setConfigSection.mockResolvedValue({ status: 'running' })
  })

  it('available reflects hasFeature(config-sections) — true when present', () => {
    expect(useRuleEditor().available.value).toBe(true)
  })

  it('available is false when the config-sections feature is absent', () => {
    featurePresent = false
    expect(useRuleEditor().available.value).toBe(false)
  })

  it('load() GETs the rules section and parses each line into {type,payload,policy}', async () => {
    const ed = useRuleEditor()
    await ed.load()
    expect(api.getConfigSection).toHaveBeenCalledWith('rules')
    expect(ed.rules.value).toEqual([
      { type: 'DOMAIN-SUFFIX', payload: 'google.com', policy: 'PROXY' },
      // params after the policy are preserved on round-trip.
      {
        type: 'IP-CIDR',
        payload: '10.0.0.0/8',
        policy: 'DIRECT',
        params: ['no-resolve'],
      },
      // no-payload rule (MATCH): second token is the policy, payload empty.
      { type: 'MATCH', payload: '', policy: 'DIRECT' },
    ])
  })

  it('load() tolerates a null section (no rules / no active profile) as empty', async () => {
    api.getConfigSection.mockResolvedValue(null)
    const ed = useRuleEditor()
    await ed.load()
    expect(ed.rules.value).toEqual([])
  })

  it('add() appends a rule entry', async () => {
    const ed = useRuleEditor()
    await ed.load()
    ed.add({ type: 'DOMAIN', payload: 'a.com', policy: 'REJECT' })
    expect(ed.rules.value.at(-1)).toEqual({
      type: 'DOMAIN',
      payload: 'a.com',
      policy: 'REJECT',
    })
  })

  it('update() replaces the rule at the given index', async () => {
    const ed = useRuleEditor()
    await ed.load()
    ed.update(0, { type: 'DOMAIN', payload: 'b.com', policy: 'DIRECT' })
    expect(ed.rules.value[0]).toEqual({
      type: 'DOMAIN',
      payload: 'b.com',
      policy: 'DIRECT',
    })
  })

  it('remove() drops the rule at the given index', async () => {
    const ed = useRuleEditor()
    await ed.load()
    ed.remove(1)
    expect(ed.rules.value.map((r) => r.type)).toEqual([
      'DOMAIN-SUFFIX',
      'MATCH',
    ])
  })

  it('move() reorders a rule from one index to another (drag)', async () => {
    const ed = useRuleEditor()
    await ed.load()
    // move the last rule (MATCH) to the front
    ed.move(2, 0)
    expect(ed.rules.value.map((r) => r.type)).toEqual([
      'MATCH',
      'DOMAIN-SUFFIX',
      'IP-CIDR',
    ])
  })

  it('isValid() rejects entries with an empty type / payload / policy', () => {
    const ed = useRuleEditor()
    expect(ed.isValid({ type: '', payload: 'a', policy: 'P' })).toBe(false)
    expect(ed.isValid({ type: 'DOMAIN', payload: '', policy: 'P' })).toBe(false)
    expect(ed.isValid({ type: 'DOMAIN', payload: 'a', policy: '' })).toBe(false)
    expect(ed.isValid({ type: 'DOMAIN', payload: 'a', policy: 'P' })).toBe(true)
  })

  it('isValid() allows a no-payload type (MATCH) with empty payload', () => {
    const ed = useRuleEditor()
    expect(ed.isValid({ type: 'MATCH', payload: '', policy: 'DIRECT' })).toBe(
      true,
    )
  })

  it('save() serializes the entries back to strings and PUTs ONCE', async () => {
    const ed = useRuleEditor()
    await ed.load()
    ed.add({ type: 'DOMAIN', payload: 'a.com', policy: 'REJECT' })
    const ok = await ed.save()
    expect(ok).toBe(true)
    expect(api.setConfigSection).toHaveBeenCalledTimes(1)
    expect(api.setConfigSection).toHaveBeenCalledWith({
      key: 'rules',
      value: [
        'DOMAIN-SUFFIX,google.com,PROXY',
        // params round-trip back after the policy.
        'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
        'MATCH,DIRECT',
        'DOMAIN,a.com,REJECT',
      ],
    })
  })

  it('load() surfaces failures via toast.error (no swallowing) and clears loading', async () => {
    api.getConfigSection.mockRejectedValue(new Error('boom'))
    const ed = useRuleEditor()
    await ed.load()
    expect(toast.error).toHaveBeenCalled()
    expect(ed.loading.value).toBe(false)
  })

  it('save() surfaces failures via toast.error and returns false', async () => {
    api.setConfigSection.mockRejectedValue(new Error('boom'))
    const ed = useRuleEditor()
    await ed.load()
    const ok = await ed.save()
    expect(ok).toBe(false)
    expect(toast.error).toHaveBeenCalled()
    expect(ed.loading.value).toBe(false)
  })

  it('save() refuses to PUT when an entry is invalid and toasts instead', async () => {
    const ed = useRuleEditor()
    await ed.load()
    ed.add({ type: '', payload: '', policy: '' })
    const ok = await ed.save()
    expect(ok).toBe(false)
    expect(api.setConfigSection).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })
})
