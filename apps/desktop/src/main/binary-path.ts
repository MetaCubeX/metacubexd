import { join } from 'node:path'

export interface ResolveBinaryInput {
  /** process.platform of the running Electron process. */
  platform: NodeJS.Platform
  /** app.isPackaged. */
  isPackaged: boolean
  /** process.resourcesPath (only meaningful when packaged). */
  resourcesPath: string
  /** app.getAppPath() (the package root in dev). */
  appPath: string
  /** Optional user-configured absolute path; when set, always wins. */
  userOverride?: string
}

/**
 * Resolve the mihomo executable path. Pure — no fs, no electron.
 * - userOverride (non-empty) always wins, verbatim.
 * - packaged  -> <resourcesPath>/mihomo[.exe]
 * - dev       -> <appPath>/resources/mihomo[.exe]
 */
export function resolveMihomoBinary(input: ResolveBinaryInput): string {
  if (input.userOverride && input.userOverride.length > 0) {
    return input.userOverride
  }
  const exe = input.platform === 'win32' ? 'mihomo.exe' : 'mihomo'
  return input.isPackaged
    ? join(input.resourcesPath, exe)
    : join(input.appPath, 'resources', exe)
}
