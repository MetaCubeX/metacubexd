import type { KernelManager, MihomoSupervisor } from '@metacubexd/agent/types'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  fetchKernel as defaultFetchKernel,
  listMihomoVersions,
  MIHOMO_VERSION,
} from '@metacubexd/agent'

/** Download a mihomo release tag into destDir; returns the extracted binary path. */
export type FetchKernelFn = (
  os: string,
  arch: string,
  destDir: string,
  deps: { version: string },
) => Promise<{ binPath: string }>

/** List installable mihomo kernel tags, newest first. */
export type ListVersionsFn = () => Promise<string[]>

/** Persist the resolved binary path so a cold start picks the same kernel. */
export type WriteOverrideFn = (path: string, binPath: string) => Promise<void>

export interface KernelManagerOptions {
  /** The live kernel supervisor — switched via setBinaryPath + restart. */
  supervisor: MihomoSupervisor
  /** process.platform (linux/darwin/win32). */
  os: string
  /** process.arch (x64/arm64). */
  arch: string
  /** Root dir for downloaded kernels; each version lands in <kernelsDir>/<version>. */
  kernelsDir: string
  /** Settings file read at boot as the binary override (cold-start persistence). */
  overridePath: string
  /** Injected downloader; defaults to the agent's fetchKernel. */
  fetchKernel?: FetchKernelFn
  /** Injected version lister; defaults to the agent's listMihomoVersions. */
  listVersions?: ListVersionsFn
  /** Optional token for authenticated GitHub Releases metadata requests. */
  githubToken?: string
  /** Injected override writer; defaults to fs.writeFile (utf8). */
  writeOverride?: WriteOverrideFn
}

const defaultWriteOverride: WriteOverrideFn = (path, binPath) =>
  writeFile(path, binPath, 'utf8')

/**
 * Build the desktop KernelManager: enumerate installable mihomo versions and
 * switch the active kernel binary. Switching = download the requested release,
 * persist the path to the cold-start override file, then live-swap the running
 * supervisor (setBinaryPath + restart). All side effects (download / fs write /
 * supervisor) are injectable so tests assert the call sequence without touching
 * the network or filesystem.
 */
export function createKernelManager(opts: KernelManagerOptions): KernelManager {
  const fetchKernel = opts.fetchKernel ?? defaultFetchKernel
  const listVersions =
    opts.listVersions ??
    (() => listMihomoVersions({ githubToken: opts.githubToken }))
  const writeOverride = opts.writeOverride ?? defaultWriteOverride

  return {
    async listVersions() {
      const versions = await listVersions()
      return {
        versions,
        current: opts.supervisor.getState().version,
        bundled: MIHOMO_VERSION,
      }
    },
    async switch(version) {
      const destDir = join(opts.kernelsDir, version)
      const { binPath } = await fetchKernel(opts.os, opts.arch, destDir, {
        version,
      })
      // Persist for cold start BEFORE the live swap so a crash mid-restart still
      // boots the newly downloaded kernel next time.
      await writeOverride(opts.overridePath, binPath)
      opts.supervisor.setBinaryPath(binPath)
      await opts.supervisor.restart()
    },
  }
}
