// electron-builder `beforePack` hook: stage the ARCH-CORRECT mihomo (+ wintun on
// Windows) into resources/ before EACH arch is packed.
//
// Why this exists: the Windows and Linux release legs build BOTH --x64 and
// --arm64 from a single x64 host in ONE electron-builder invocation (see
// .github/workflows/release.yml). extraResources copies the single
// resources/mihomo[.exe] staged by `fetch:mihomo` — which defaults to the host
// arch — so without re-staging per arch the arm64 installer would ship the x64
// kernel and the app's core proxy function would be broken on arm64.
//
// beforePack fires once per (platform, arch) right before that arch's app dir is
// assembled, so re-staging here guarantees extraResources picks up the matching
// binary. fetch-mihomo.mjs is arch-aware (sidecar marker), so this is a no-op
// download when the right arch is already staged and a real download on a
// mismatch — no --force needed, no redundant fetches.
const { execFileSync } = require('node:child_process')
const { Arch } = require('electron-builder')

/** @param {import('electron-builder').BeforePackContext} context */
exports.default = async function beforePack(context) {
  // Arch enum -> the string fetch-mihomo.mjs expects ('x64' | 'arm64' | ...).
  const arch = Arch[context.arch]
  // Platform.nodeName -> 'darwin' | 'win32' | 'linux'.
  const os = context.packager.platform.nodeName

  console.log(`[before-pack] staging mihomo for os=${os} arch=${arch}`)
  // shell: true so Windows resolves `pnpm` -> `pnpm.cmd` (execFileSync can't
  // find the bare `pnpm` on win32, which is what broke the Windows release leg).
  execFileSync(
    'pnpm',
    [
      '--filter',
      '@metacubexd/desktop',
      'exec',
      'tsx',
      'scripts/fetch-mihomo.mjs',
      '--os',
      os,
      '--arch',
      arch,
    ],
    { stdio: 'inherit', shell: true },
  )
}
