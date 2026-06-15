import type { KernelState } from '@metacubexd/agent/types'
import { describe, expect, it, vi } from 'vitest'
import { createKernelCrashWatcher, createNotifier } from '../notifier'

function state(patch: Partial<KernelState>): KernelState {
  return {
    status: 'stopped',
    externalController: '127.0.0.1:9090',
    secret: '',
    ...patch,
  }
}

// A fake Electron Notification constructor: records the options each
// construction receives and whether show() was called, so the test can assert
// against them without firing a real OS notification.
function fakeNotification() {
  const constructed: Array<{ title?: string; body?: string }> = []
  const shown: Array<{ title?: string; body?: string }> = []
  class FakeNotification {
    options: { title?: string; body?: string }
    constructor(options: { title?: string; body?: string }) {
      this.options = options
      constructed.push(options)
    }

    show(): void {
      shown.push(this.options)
    }
  }
  return {
    Notification: FakeNotification as unknown as typeof Electron.Notification,
    constructed,
    shown,
  }
}

describe('createNotifier', () => {
  it('constructs an Electron Notification with the given title/body and shows it', () => {
    const fake = fakeNotification()
    const notifier = createNotifier({ Notification: fake.Notification })
    notifier.notify('Kernel stopped', 'unexpected exit')
    expect(fake.constructed).toEqual([
      { title: 'Kernel stopped', body: 'unexpected exit' },
    ])
    expect(fake.shown).toEqual([
      { title: 'Kernel stopped', body: 'unexpected exit' },
    ])
  })

  it('shows a fresh Notification per notify() call', () => {
    const fake = fakeNotification()
    const notifier = createNotifier({ Notification: fake.Notification })
    notifier.notify('A', 'one')
    notifier.notify('B', 'two')
    expect(fake.shown).toEqual([
      { title: 'A', body: 'one' },
      { title: 'B', body: 'two' },
    ])
  })

  it('does not fire a real notification (uses only the injected constructor)', () => {
    const fake = fakeNotification()
    const ctor = vi.fn().mockImplementation(function (
      this: { options: unknown; show: () => void },
      options: unknown,
    ) {
      this.options = options
      this.show = () => {}
    })
    const notifier = createNotifier({
      Notification: ctor as unknown as typeof Electron.Notification,
    })
    notifier.notify('T', 'B')
    expect(ctor).toHaveBeenCalledTimes(1)
    expect(ctor).toHaveBeenCalledWith({ title: 'T', body: 'B' })
    void fake
  })
})

describe('createKernelCrashWatcher', () => {
  it('notifies once when the kernel transitions into errored, using lastError', () => {
    const notify = vi.fn()
    const watch = createKernelCrashWatcher(notify)
    watch(state({ status: 'errored', lastError: 'boom' }))
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith('Kernel stopped', 'boom')
  })

  it('falls back to a generic message when lastError is absent', () => {
    const notify = vi.fn()
    const watch = createKernelCrashWatcher(notify)
    watch(state({ status: 'errored' }))
    expect(notify).toHaveBeenCalledWith('Kernel stopped', 'unexpected exit')
  })

  it('de-dupes: a sustained errored state only notifies on the transition', () => {
    const notify = vi.fn()
    const watch = createKernelCrashWatcher(notify)
    watch(state({ status: 'errored', lastError: 'boom' }))
    watch(state({ status: 'errored', lastError: 'boom' }))
    watch(state({ status: 'errored', lastError: 'boom' }))
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('re-arms after recovery so a later crash notifies again', () => {
    const notify = vi.fn()
    const watch = createKernelCrashWatcher(notify)
    watch(state({ status: 'errored', lastError: 'first' }))
    watch(state({ status: 'running' }))
    watch(state({ status: 'errored', lastError: 'second' }))
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenNthCalledWith(1, 'Kernel stopped', 'first')
    expect(notify).toHaveBeenNthCalledWith(2, 'Kernel stopped', 'second')
  })

  it('does not notify for non-errored states', () => {
    const notify = vi.fn()
    const watch = createKernelCrashWatcher(notify)
    watch(state({ status: 'starting' }))
    watch(state({ status: 'running' }))
    watch(state({ status: 'stopping' }))
    watch(state({ status: 'stopped' }))
    expect(notify).not.toHaveBeenCalled()
  })
})
