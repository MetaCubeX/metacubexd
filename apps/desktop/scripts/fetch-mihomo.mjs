#!/usr/bin/env node
// Stage the arch-correct mihomo binary into apps/desktop/resources/.
// Default: current host os/arch. Override with --os <linux|darwin|win32> --arch <x64|arm64>.
// Idempotent BUT ARCH-AWARE: skips only when the binary already staged matches
// the requested os/arch (tracked via a sidecar marker), so repeated
// `dev:desktop` runs don't re-fetch, while a different-arch request re-downloads.
// Pass --force to always re-download (e.g. after a MIHOMO_VERSION bump).
// electron-builder's extraResources copies resources/mihomo[.exe] from here; the
// per-arch staging during a multi-arch pack is driven by scripts/before-pack.cjs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchKernel } from '@metacubexd/agent/kernel/fetch-kernel'
import { mihomoAsset } from '@metacubexd/agent/kernel/assets'
import { fetchWintun } from '@metacubexd/agent/kernel/fetch-wintun'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources')

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const os = flag('os', process.platform) // 'linux' | 'darwin' | 'win32'
const arch = flag('arch', process.arch) // 'x64' | 'arm64'
const force = process.argv.includes('--force')

const expectedBin = join(resourcesDir, mihomoAsset(os, arch).binName)
// The staged binary's filename (mihomo / mihomo.exe) is arch-INDEPENDENT, so a
// bare existence check can't distinguish an x64 binary from an arm64 one. A
// multi-arch electron-builder run (one x64 host building BOTH --x64 and --arm64)
// would otherwise keep the first-staged arch and ship the WRONG kernel in the
// second arch's installer. Record what's staged in a sidecar marker and only
// skip when it matches the requested target.
const markerPath = join(resourcesDir, '.mihomo-target')
const wantTarget = `${os}-${arch}`
const staged = existsSync(expectedBin)
const markerMatches =
  existsSync(markerPath) &&
  readFileSync(markerPath, 'utf8').trim() === wantTarget

if (!force && staged && markerMatches) {
  console.log(
    `[fetch-mihomo] already staged for ${wantTarget}: ${expectedBin} (pass --force to re-download)`,
  )
  process.exit(0)
}
if (staged && !markerMatches) {
  console.log(
    `[fetch-mihomo] staged binary is for a different target (want ${wantTarget}); re-downloading`,
  )
}

console.log(`[fetch-mihomo] os=${os} arch=${arch} -> ${resourcesDir}`)
const { binPath } = await fetchKernel(os, arch, resourcesDir)
console.log(`[fetch-mihomo] staged: ${binPath}`)

// Windows TUN: mihomo's wintun backend needs wintun.dll alongside the kernel.
// wintun.dll is ALSO arch-specific, so re-fetch it whenever we (re)stage the
// kernel — we only reach this point when staging is actually needed (force,
// missing, or arch change), so an unconditional fetch here can't ship a stale
// wrong-arch dll the way an existence-only skip could.
if (os === 'win32' || os === 'windows') {
  console.log(`[fetch-mihomo] fetching wintun.dll (arch=${arch})`)
  const { dllPath } = await fetchWintun(arch, resourcesDir)
  console.log(`[fetch-mihomo] staged: ${dllPath}`)
}

// Stamp the marker last, so a crash mid-download doesn't leave a marker that
// would wrongly let a re-run skip an incomplete staging.
writeFileSync(markerPath, wantTarget)
