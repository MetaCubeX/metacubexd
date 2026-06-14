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
  }
}
