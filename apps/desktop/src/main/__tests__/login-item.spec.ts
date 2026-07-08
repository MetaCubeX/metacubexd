import type { AutostartFsLike, LoginItemAppLike } from '../login-item'
import { describe, expect, it, vi } from 'vitest'
import {
  buildAutostartDesktopEntry,
  createLinuxAutostart,
  createLoginItemController,
  desktopExecArg,
} from '../login-item'

function fakeFs(initial: Record<string, string> = {}): {
  fs: AutostartFsLike
  files: Record<string, string>
  dirs: Set<string>
} {
  const files = { ...initial }
  const dirs = new Set<string>()
  const fs: AutostartFsLike = {
    existsSync: (p) => p in files || dirs.has(p),
    mkdirSync: (p) => void dirs.add(p),
    writeFileSync: (p, data) => {
      files[p] = data
    },
    unlinkSync: (p) => {
      delete files[p]
    },
  }
  return { fs, files, dirs }
}

const LINUX_OPTS = {
  autostartDir: '/home/u/.config/autostart',
  execPath: '/opt/MetaCubeXD/metacubexd',
  name: 'metacubexd',
}

describe('desktopExecArg', () => {
  it('quotes the path and escapes the freedesktop-reserved characters', () => {
    expect(desktopExecArg('/plain/path')).toBe('"/plain/path"')
    expect(desktopExecArg('/pa"th/$app`x\\y')).toBe(
      '"/pa\\"th/\\$app\\`x\\\\y"',
    )
  })
})

describe('buildAutostartDesktopEntry', () => {
  it('renders a valid autostart entry launching hidden', () => {
    const entry = buildAutostartDesktopEntry('/opt/App Image.AppImage', 'mcxd')
    expect(entry).toContain('[Desktop Entry]')
    expect(entry).toContain('Type=Application')
    expect(entry).toContain('Name=mcxd')
    expect(entry).toContain('Exec="/opt/App Image.AppImage" --hidden')
    expect(entry).toContain('X-GNOME-Autostart-enabled=true')
  })
})

describe('createLinuxAutostart', () => {
  it('reports disabled when no .desktop entry exists', () => {
    const { fs } = fakeFs()
    const ctl = createLinuxAutostart({ fs, ...LINUX_OPTS })
    expect(ctl.isEnabled()).toBe(false)
  })

  it('setEnabled(true) creates the dir + writes the entry; isEnabled flips', () => {
    const { fs, files, dirs } = fakeFs()
    const ctl = createLinuxAutostart({ fs, ...LINUX_OPTS })
    ctl.setEnabled(true)
    expect(dirs.has(LINUX_OPTS.autostartDir)).toBe(true)
    const entry = files[`${LINUX_OPTS.autostartDir}/metacubexd.desktop`]
    expect(entry).toContain('Exec="/opt/MetaCubeXD/metacubexd" --hidden')
    expect(ctl.isEnabled()).toBe(true)
  })

  it('setEnabled(false) removes the entry and is a no-op when absent', () => {
    const { fs, files } = fakeFs()
    const ctl = createLinuxAutostart({ fs, ...LINUX_OPTS })
    ctl.setEnabled(true)
    ctl.setEnabled(false)
    expect(files).toEqual({})
    // Absent already — must not throw.
    expect(() => ctl.setEnabled(false)).not.toThrow()
  })
})

describe('createLoginItemController', () => {
  const electronApp = () => {
    const setLoginItemSettings =
      vi.fn<LoginItemAppLike['setLoginItemSettings']>()
    const app: LoginItemAppLike = {
      getLoginItemSettings: () => ({ openAtLogin: true }),
      setLoginItemSettings,
    }
    return { app, setLoginItemSettings }
  }

  it('delegates to Electron login-item settings on darwin/win32 (with --hidden)', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const { app, setLoginItemSettings } = electronApp()
      const ctl = createLoginItemController({
        platform,
        app,
        linux: { fs: fakeFs().fs, ...LINUX_OPTS },
      })
      expect(ctl.isEnabled()).toBe(true)
      ctl.setEnabled(true)
      expect(setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        args: ['--hidden'],
      })
    }
  })

  it('uses the XDG autostart entry on linux (Electron API is a no-op there)', () => {
    const { app, setLoginItemSettings } = electronApp()
    const { fs, files } = fakeFs()
    const ctl = createLoginItemController({
      platform: 'linux',
      app,
      linux: { fs, ...LINUX_OPTS },
    })
    ctl.setEnabled(true)
    expect(setLoginItemSettings).not.toHaveBeenCalled()
    expect(files[`${LINUX_OPTS.autostartDir}/metacubexd.desktop`]).toBeDefined()
  })
})
