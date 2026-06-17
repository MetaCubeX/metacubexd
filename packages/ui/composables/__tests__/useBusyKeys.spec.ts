// packages/ui/composables/__tests__/useBusyKeys.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useBusyKeys } from '../useBusyKeys'

// `reactive`/`computed` are provided as global auto-import stubs via test/setup.

describe('composables/useBusyKeys', () => {
  it('marks only the targeted key busy during the async fn, clears it after', async () => {
    const { isBusy, run } = useBusyKeys()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))

    const p = run('activate:a', () => gate)
    await nextTick()
    expect(isBusy('activate:a')).toBe(true)
    // A different key (and a different id of the same action) is untouched.
    expect(isBusy('activate:b')).toBe(false)
    expect(isBusy('delete:a')).toBe(false)

    release()
    await p
    expect(isBusy('activate:a')).toBe(false)
  })

  it('clears the key even when the fn rejects (and rethrows)', async () => {
    const { isBusy, run } = useBusyKeys()
    await expect(
      run('delete:x', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom')
    expect(isBusy('delete:x')).toBe(false)
  })

  it('ignores a re-fire of an already-in-flight key (double-submit guard)', async () => {
    const { run } = useBusyKeys()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const fn = vi.fn(() => gate)

    const first = run('create', fn)
    await nextTick()
    // Second call while the first is still pending must NOT invoke fn again.
    await run('create', fn)
    expect(fn).toHaveBeenCalledTimes(1)

    release()
    await first
    // Once cleared, the key can run again.
    await run('create', fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('anyBusy reflects whether any key is in flight', async () => {
    const { anyBusy, run } = useBusyKeys()
    expect(anyBusy.value).toBe(false)
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const p = run('refresh:a', () => gate)
    await nextTick()
    expect(anyBusy.value).toBe(true)
    release()
    await p
    expect(anyBusy.value).toBe(false)
  })
})
