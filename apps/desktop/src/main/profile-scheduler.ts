import type { ProfileScheduler, ProfileSchedulerDeps } from '@metacubexd/agent'
import type { MihomoSupervisor } from '@metacubexd/agent/types'
import type { DesktopTunController } from './tun-controller'
import { applyActiveRefresh, createProfileScheduler } from '@metacubexd/agent'

export interface DesktopProfileSchedulerOptions extends Omit<
  ProfileSchedulerDeps,
  'apply' | 'onResult'
> {
  supervisor: MihomoSupervisor
  tunController: DesktopTunController
  homeDir: string
  notify: (title: string, detail: string) => void
}

export function createDesktopProfileScheduler(
  options: DesktopProfileSchedulerOptions,
): ProfileScheduler {
  const { supervisor, tunController, homeDir, notify, ...scheduler } = options
  const refreshSupervisor: MihomoSupervisor = {
    ...supervisor,
    async restart() {
      // One controller transition preserves the current owner and serializes
      // with user enable/disable requests. A later user disable must win over
      // this automatic restart, even while privileged shutdown is in flight.
      await tunController.restart()
      return supervisor.getState()
    },
  }
  return createProfileScheduler({
    ...scheduler,
    apply: (id) =>
      applyActiveRefresh(scheduler.profiles, refreshSupervisor, id, {
        homeDir,
      }),
    onResult: (result) => {
      if (result.ok) notify('Subscription updated', `${result.id} refreshed.`)
      else notify('Subscription update failed', result.error ?? result.id)
    },
  })
}
