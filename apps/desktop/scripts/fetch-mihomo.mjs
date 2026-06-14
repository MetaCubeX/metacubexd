#!/usr/bin/env node
// Stage the arch-correct mihomo binary into apps/desktop/resources/.
// Default: current host os/arch. Override with --os <linux|darwin|win32> --arch <x64|arm64>.
// electron-builder's extraResources copies resources/mihomo[.exe] from here.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchKernel } from '@metacubexd/agent/kernel/fetch-kernel'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources')

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const os = flag('os', process.platform) // 'linux' | 'darwin' | 'win32'
const arch = flag('arch', process.arch) // 'x64' | 'arm64'

console.log(`[fetch-mihomo] os=${os} arch=${arch} -> ${resourcesDir}`)
const { binPath } = await fetchKernel(os, arch, resourcesDir)
console.log(`[fetch-mihomo] staged: ${binPath}`)
