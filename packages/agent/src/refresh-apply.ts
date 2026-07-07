import type { MihomoSupervisor, ProfileStore } from './types'

// A refreshed subscription only takes effect once recomposed into the active
// config. Shared by the manual refresh route (#2108) and the auto-update
// scheduler's onResult hook (#2107): when the refreshed profile IS the active
// base, re-compose active.yaml + restart the kernel so the new nodes/rules
// actually route. A non-active profile just updates storage — activating it
// later composes the fresh content. No-op when the profile is not the active one.
export async function applyActiveRefresh(
  profiles: ProfileStore,
  supervisor: MihomoSupervisor,
  id: string,
): Promise<void> {
  const activeId = await profiles.getActiveId()
  if (!activeId || activeId !== id) return
  await profiles.setActive(activeId)
  await supervisor.restart()
}
