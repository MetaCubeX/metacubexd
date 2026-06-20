export const MIHOMO_VERSION = process.env.MIHOMO_VERSION ?? 'v1.19.27'

const OS_MAP: Record<string, 'linux' | 'darwin' | 'windows'> = {
  linux: 'linux',
  darwin: 'darwin',
  win32: 'windows',
  windows: 'windows',
}

const ARCH_MAP: Record<string, 'amd64' | 'arm64'> = {
  x64: 'amd64',
  amd64: 'amd64',
  arm64: 'arm64',
}

export interface MihomoAsset {
  name: string
  url: string
  ext: 'gz' | 'zip'
  binName: 'mihomo' | 'mihomo.exe'
  /**
   * The entry to extract from a `.zip` (Windows). It is the UN-versioned full
   * name inside the archive (e.g. `mihomo-windows-amd64-compatible.exe`), which
   * differs from the output `binName` (`mihomo.exe`). Undefined for `.gz`.
   */
  zipEntry?: string
}

export function mihomoAsset(
  os: string,
  arch: string,
  version: string = MIHOMO_VERSION,
): MihomoAsset {
  const o = OS_MAP[os]
  if (!o) throw new Error(`unsupported os: ${os}`)
  const a = ARCH_MAP[arch]
  if (!a) throw new Error(`unsupported arch: ${arch}`)

  const ext = o === 'windows' ? 'zip' : 'gz'
  const variant = a === 'amd64' ? '-compatible' : ''
  const name = `mihomo-${o}-${a}${variant}-${version}.${ext}`
  return {
    name,
    url: `https://github.com/MetaCubeX/mihomo/releases/download/${version}/${name}`,
    ext,
    binName: o === 'windows' ? 'mihomo.exe' : 'mihomo',
    zipEntry: ext === 'zip' ? `mihomo-${o}-${a}${variant}.exe` : undefined,
  }
}
