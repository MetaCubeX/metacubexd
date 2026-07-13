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

describe('desktop distribution configuration', () => {
  it('builds every supported Linux package for x64 and arm64', () => {
    const config = parse(
      readFileSync(resolve(desktopRoot, 'electron-builder.yml'), 'utf8'),
    ) as BuilderConfig

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
  })

  it('publishes native Linux packages and installs the RPM build tool', () => {
    const workflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/release.yml'),
      'utf8',
    )

    expect(workflow).toContain('apt-get install --no-install-recommends -y rpm')
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
