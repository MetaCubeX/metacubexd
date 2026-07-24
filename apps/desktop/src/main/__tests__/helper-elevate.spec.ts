import { describe, expect, it, vi } from 'vitest'
import { createHelperElevate } from '../helper/elevate'

interface ExecResult {
  stdout: string
  stderr: string
}

function makeExec() {
  const calls: string[] = []
  const exec = vi.fn(async (cmd: string): Promise<ExecResult> => {
    calls.push(cmd)
    return { stdout: '', stderr: '' }
  })
  return { exec, calls }
}

function makeFs(tmpdir = 'C:\\Users\\me\\AppData\\Local\\Temp') {
  const files = new Map<string, string>()
  const writes: Array<{ path: string; data: string }> = []
  const unlinked: string[] = []
  return {
    files,
    writes,
    unlinked,
    fs: {
      writeFileSync: (path: string, data: string) => {
        files.set(path, data)
        writes.push({ path, data })
      },
      unlinkSync: (path: string) => {
        unlinked.push(path)
        files.delete(path)
      },
      tmpdir: () => tmpdir,
      join: (...parts: string[]) => parts.join('\\'),
    },
  }
}

describe('createHelperElevate', () => {
  describe('darwin', () => {
    it('wraps the script in osascript with administrator privileges', async () => {
      const { exec, calls } = makeExec()
      const elevate = createHelperElevate({
        platform: 'darwin',
        exec,
        fs: makeFs('/tmp').fs,
      })

      await elevate('echo hi')

      expect(calls).toHaveLength(1)
      expect(calls[0]).toContain('osascript -e')
      expect(calls[0]).toContain('with administrator privileges')
      expect(calls[0]).toContain('echo hi')
    })
  })

  describe('linux', () => {
    it('runs the script through pkexec bash -c', async () => {
      const { exec, calls } = makeExec()
      const elevate = createHelperElevate({
        platform: 'linux',
        exec,
        fs: makeFs('/tmp').fs,
      })

      await elevate('systemctl enable --now metacubexd-helper')

      expect(calls).toHaveLength(1)
      expect(calls[0]?.startsWith('pkexec /bin/bash -c ')).toBe(true)
      expect(calls[0]).toContain('systemctl enable --now metacubexd-helper')
    })
  })

  describe('windows (win32)', () => {
    it('writes a temp .cmd and launches it via UAC Start-Process -Verb RunAs (#2116)', async () => {
      const { exec, calls } = makeExec()
      const { fs, writes, unlinked } = makeFs()
      const elevate = createHelperElevate({
        platform: 'win32',
        exec,
        fs,
        // Deterministic name so the assertion is stable.
        tempName: () => 'mcxd-elevate-test.cmd',
      })

      const script = [
        'sc create metacubexd-helper binPath= "C:\\app\\electron.exe C:\\app\\helper.js" start= auto',
        'sc start metacubexd-helper',
      ].join('\r\n')
      await elevate(script)

      const tmpPath =
        'C:\\Users\\me\\AppData\\Local\\Temp\\mcxd-elevate-test.cmd'
      expect(writes).toEqual([{ path: tmpPath, data: script }])
      expect(calls).toHaveLength(1)
      const command = calls[0]?.toLowerCase() ?? ''
      expect(command).toContain('powershell')
      // Resolved by absolute path — a bare `powershell` lookup fails when
      // Electron spawns with a reduced PATH (#2149).
      expect(command).toContain('\\system32\\windowspowershell\\v1.0\\')
      expect(command).toContain('start-process')
      expect(command).toContain('-verb runas')
      expect(calls[0]).toContain(tmpPath)
      // Temp script cleaned up after the elevated process returns.
      expect(unlinked).toContain(tmpPath)
    })

    it('still cleans up the temp .cmd when UAC is cancelled', async () => {
      const exec = vi.fn(async () => {
        throw new Error('The operation was canceled by the user.')
      })
      const { fs, unlinked } = makeFs()
      const elevate = createHelperElevate({
        platform: 'win32',
        exec,
        fs,
        tempName: () => 'mcxd-elevate-cancel.cmd',
      })

      await expect(elevate('sc create x')).rejects.toThrow('canceled')
      expect(unlinked).toContain(
        'C:\\Users\\me\\AppData\\Local\\Temp\\mcxd-elevate-cancel.cmd',
      )
    })
  })

  it('throws on unsupported platforms', async () => {
    const { exec } = makeExec()
    const elevate = createHelperElevate({
      platform: 'freebsd' as NodeJS.Platform,
      exec,
      fs: makeFs().fs,
    })
    await expect(elevate('echo hi')).rejects.toThrow('unsupported platform')
  })
})
