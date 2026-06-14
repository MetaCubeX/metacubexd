#!/usr/bin/env node
// Stage the arch-correct mihomo binary into apps/desktop/resources/.
// Default: current host os/arch. Override with --os <linux|darwin|win32> --arch <x64|arm64>.
// Idempotent: skips the download when the binary is already staged (use --force
// to re-download, e.g. after a MIHOMO_VERSION bump) so repeated `dev:desktop`
// runs don't re-fetch the kernel every launch.
// electron-builder's extraResources copies resources/mihomo[.exe] from here.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchKernel } from '@metacubexd/agent/kernel/fetch-kernel'
import { mihomoAsset } from '@metacubexd/agent/kernel/assets'

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
if (!force && existsSync(expectedBin)) {
  console.log(
    `[fetch-mihomo] already staged: ${expectedBin} (pass --force to re-download)`,
  )
  process.exit(0)
}

console.log(`[fetch-mihomo] os=${os} arch=${arch} -> ${resourcesDir}`)
const { binPath } = await fetchKernel(os, arch, resourcesDir)
console.log(`[fetch-mihomo] staged: ${binPath}`)
