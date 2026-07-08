import type { KernelState } from '@metacubexd/agent/types'
import type { Notification } from 'electron'

export interface NotifierDeps {
  /**
   * The Electron Notification constructor (injected so tests can assert the
   * construction args without firing a real OS notification).
   */
  Notification: typeof Notification
  /**
   * Optional click handler wired onto every toast. The desktop wires this to
   * summon + focus the main window — a user clicking "Kernel stopped" or
   * "Subscription updated" expects the dashboard, not a dismissed toast.
   */
  onClick?: () => void
}

export interface Notifier {
  /** Construct and show a desktop notification with the given title + body. */
  notify: (title: string, body: string) => void
}

// Thin wrapper around the Electron Notification constructor. Kept dependency-
// injected so the kernel-crash / subscription-update notifications can be unit
// tested (the fake constructor records args) and never fire a real OS toast.
export function createNotifier(deps: NotifierDeps): Notifier {
  const { Notification: NotificationCtor, onClick } = deps
  return {
    notify(title, body) {
      const n = new NotificationCtor({ title, body })
      if (onClick) n.on('click', onClick)
      n.show()
    },
  }
}

/**
 * Build a kernel-state observer that fires a crash notification exactly once per
 * transition into the `errored` status. A sustained errored state (the
 * supervisor may re-emit it) is de-duped; the watcher re-arms once the kernel
 * leaves `errored` (e.g. an auto-restart succeeds) so a later crash notifies
 * again. Pure over an injected notify(), so it is fully unit-testable.
 */
export function createKernelCrashWatcher(
  notify: (title: string, body: string) => void,
): (state: KernelState) => void {
  let wasErrored = false
  return (state) => {
    const isErrored = state.status === 'errored'
    if (isErrored && !wasErrored) {
      notify('Kernel stopped', state.lastError ?? 'unexpected exit')
    }
    wasErrored = isErrored
  }
}
