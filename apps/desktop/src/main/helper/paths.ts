import { join } from 'node:path'

export interface ResolveHelperEntryInput {
  /** app.isPackaged. */
  isPackaged: boolean
  /** process.resourcesPath (only meaningful when packaged). */
  resourcesPath: string
  /** app.getAppPath() (the package root in dev). */
  appPath: string
}

/**
 * Resolve the absolute path to the helper entry (`out/helper/index.js`) that the
 * privileged service must execute (`<electron-bin> <helperEntry>` with
 * ELECTRON_RUN_AS_NODE=1, spec §12.1). Pure — no fs, no electron. Mirrors
 * resolveMihomoBinary.
 *
 * - packaged -> <resourcesPath>/app.asar.unpacked/out/helper/index.js
 *   The helper bundle is asar-UNPACKED (electron-builder.yml asarUnpack) because
 *   a file inside app.asar cannot be spawned directly by an external privileged
 *   service; the unpacked copy is a real on-disk file the service can run.
 * - dev      -> <appPath>/out/helper/index.js
 *   The electron-vite build emits the helper as a sibling of main under out/.
 */
export function resolveHelperEntry(input: ResolveHelperEntryInput): string {
  return input.isPackaged
    ? join(
        input.resourcesPath,
        'app.asar.unpacked',
        'out',
        'helper',
        'index.js',
      )
    : join(input.appPath, 'out', 'helper', 'index.js')
}
