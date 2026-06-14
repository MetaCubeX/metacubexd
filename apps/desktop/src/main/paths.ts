import { join } from 'node:path'

export interface DataPaths {
  homeDir: string
  profilesDir: string
  activeConfigPath: string
  stateFile: string
}

/** Pure: derive the on-disk layout under a userData root. */
export function dataPaths(userData: string): DataPaths {
  const homeDir = join(userData, 'mihomo-home')
  return {
    homeDir,
    profilesDir: join(homeDir, 'profiles'),
    activeConfigPath: join(homeDir, 'config.yaml'),
    stateFile: join(homeDir, 'state.json'),
  }
}

/** Minimal fs surface so bootstrap is unit-testable with a fake. */
export interface FsLike {
  existsSync: (p: string) => boolean
  mkdirSync: (p: string) => void
  readFileSync: (p: string) => string
  writeFileSync: (p: string, data: string) => void
}

export interface BootstrapResult extends DataPaths {
  copiedDefault: boolean
}

/**
 * Ensure the userData layout exists and, on first run only, copy the
 * bundled default config into the active config slot. Idempotent.
 */
export function bootstrapDataDir(
  userData: string,
  defaultConfigPath: string,
  fs: FsLike,
): BootstrapResult {
  const p = dataPaths(userData)
  if (!fs.existsSync(p.homeDir)) fs.mkdirSync(p.homeDir)
  if (!fs.existsSync(p.profilesDir)) fs.mkdirSync(p.profilesDir)

  let copiedDefault = false
  if (!fs.existsSync(p.activeConfigPath)) {
    fs.writeFileSync(p.activeConfigPath, fs.readFileSync(defaultConfigPath))
    copiedDefault = true
  }
  return { ...p, copiedDefault }
}
