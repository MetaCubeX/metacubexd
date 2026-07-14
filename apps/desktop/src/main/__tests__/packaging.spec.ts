import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'

interface LinuxTarget {
  target: string
  arch: string[]
}

interface BuilderConfig {
  deb: {
    packageName: string
  }
  linux: {
    icon: string
    syncDesktopName: boolean
    target: LinuxTarget[]
  }
  pacman: {
    packageName: string
  }
  rpm: {
    packageName: string
  }
}

const desktopRoot = resolve(import.meta.dirname, '../../..')
const repositoryRoot = resolve(desktopRoot, '../..')

function readBuilderConfig(): BuilderConfig {
  return parse(
    readFileSync(resolve(desktopRoot, 'electron-builder.yml'), 'utf8'),
  ) as BuilderConfig
}

function readPngDimensions(path: string): { height: number; width: number } {
  const png = readFileSync(path)

  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  )

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  }
}

describe('desktop distribution configuration', () => {
  it('builds every supported Linux package for x64 and arm64', () => {
    const config = readBuilderConfig()

    const targets = Object.fromEntries(
      config.linux.target.map(({ target, arch }) => [target, arch]),
    )

    expect([
      config.deb.packageName,
      config.rpm.packageName,
      config.pacman.packageName,
    ]).toEqual(['metacubexd', 'metacubexd', 'metacubexd'])
    expect(targets).toEqual({
      AppImage: ['x64', 'arm64'],
      deb: ['x64', 'arm64'],
      rpm: ['x64', 'arm64'],
      pacman: ['x64', 'arm64'],
    })
    expect(config.linux.syncDesktopName).toBe(true)

    const packageJson = JSON.parse(
      readFileSync(resolve(desktopRoot, 'package.json'), 'utf8'),
    ) as { desktopName?: string }
    expect(packageJson.desktopName).toBe('metacubexd')
  })

  it('ships standard icon sizes for native Linux desktop menus', () => {
    const config = readBuilderConfig()

    expect(config.linux.icon).toBe('build/icons')
    for (const size of [16, 32, 48, 64, 128, 256, 512]) {
      expect(
        readPngDimensions(
          resolve(desktopRoot, config.linux.icon, `${size}x${size}.png`),
        ),
      ).toEqual({ width: size, height: size })
    }
  })

  it('publishes native Linux packages and installs their host build tools', () => {
    const workflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/release.yml'),
      'utf8',
    )

    expect(workflow).toContain(
      'apt-get install --no-install-recommends -y rpm libarchive-tools',
    )
    for (const extension of ['deb', 'rpm', 'pacman']) {
      expect(workflow).toContain(`apps/desktop/dist/*.${extension}`)
    }
  })

  it('keeps the Homebrew cask URL aligned with the stable release asset', () => {
    const workflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/release.yml'),
      'utf8',
    )
    const cask = readFileSync(
      resolve(repositoryRoot, 'Casks/metacubexd.rb'),
      'utf8',
    )

    const stableDmgAsset = [
      'apps/desktop/dist/MetaCubeXD-mac-$',
      '{{ matrix.brew_arch }}.dmg',
    ].join('')
    expect(workflow).toContain(stableDmgAsset)
    expect(cask).toContain('MetaCubeXD-mac-#{arch}.dmg')
  })
})
