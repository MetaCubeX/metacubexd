import type { MihomoSupervisor, ProfileStore } from './types'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface ApplyActiveRefreshOptions {
  homeDir?: string
}

// A refreshed subscription only takes effect once recomposed into the active
// config. Scheduled refreshes validate an isolated candidate before committing
// it, and skip the commit if the user changes the active profile or composition
// in the meantime. Non-active profiles only update storage.
export async function applyActiveRefresh(
  profiles: ProfileStore,
  supervisor: MihomoSupervisor,
  id: string,
  options: ApplyActiveRefreshOptions = {},
): Promise<void> {
  const activeId = await profiles.getActiveId()
  if (!activeId || activeId !== id) return
  const { content } = await profiles.compose(id)
  const directory = await mkdtemp(
    join(options.homeDir ?? tmpdir(), '.refresh-'),
  )
  try {
    const candidate = join(directory, 'candidate.yaml')
    await writeFile(candidate, content, { mode: 0o600 })
    const validation = await supervisor.validate(candidate)
    if (!validation.valid) {
      throw new Error(
        validation.message || 'refreshed profile validation failed',
      )
    }
    // Activation and comparison share the profile write queue, so switching
    // profiles or editing an overlay during validation cannot be overwritten.
    if (await profiles.setActiveIfCurrent(id, content)) {
      await supervisor.restart()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
