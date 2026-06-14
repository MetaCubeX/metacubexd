import type {
  ControlInfo,
  KernelState,
  ProfileDetail,
  ProfileMeta,
  SystemProxyState,
  ValidateResult,
} from '~/types/control'
// packages/ui/composables/useControlApi.ts
import ky from 'ky'

export interface ControlConfig {
  base: string
  token?: string
}

// Desktop preload bridge shape (SHARED CONTRACTS).
interface MetacubexdBridge {
  isDesktop?: boolean
  control?: { base: string; token?: string }
}

export function resolveControlConfig(): ControlConfig {
  const w =
    typeof window !== 'undefined'
      ? (window as unknown as { metacubexd?: MetacubexdBridge })
      : undefined
  const bridge = w?.metacubexd?.control
  if (bridge?.base) {
    return { base: stripTrailingSlash(bridge.base), token: bridge.token }
  }
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : ''
  return { base: `${stripTrailingSlash(origin)}/api/control` }
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, '')
}

export function useControlApi() {
  const { base, token } = resolveControlConfig()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  // ky v2: use `prefix` (prefixUrl was renamed in v2). All method paths below
  // are passed WITHOUT a leading slash so ky joins them cleanly.
  const client = ky.create({ prefix: base, headers, timeout: 15000 })

  return {
    base,
    token,
    getInfo: () => client.get('info').json<ControlInfo>(),
    getKernelStatus: () => client.get('kernel/status').json<KernelState>(),
    startKernel: () => client.post('kernel/start').json<KernelState>(),
    stopKernel: () => client.post('kernel/stop').json<KernelState>(),
    restartKernel: () => client.post('kernel/restart').json<KernelState>(),
    // EventSource cannot send Authorization headers, so the SSE route also
    // accepts ?token= (SHARED CONTRACTS). Desktop in-process binding skips
    // auth, but passing the token there is harmless.
    logsUrl: () =>
      token ? `${base}/kernel/logs?token=${token}` : `${base}/kernel/logs`,

    listProfiles: () => client.get('profiles').json<ProfileMeta[]>(),
    createProfile: (body: { name: string; content?: string }) =>
      client.post('profiles', { json: body }).json<ProfileMeta>(),
    getProfile: (id: string) =>
      client.get(`profiles/${id}`).json<ProfileDetail>(),
    updateProfile: (id: string, body: { name?: string; content?: string }) =>
      client.put(`profiles/${id}`, { json: body }).json<ProfileMeta>(),
    deleteProfile: (id: string) => client.delete(`profiles/${id}`).json<void>(),
    duplicateProfile: (id: string, name?: string) =>
      client
        .post(`profiles/${id}/duplicate`, { json: { name } })
        .json<ProfileMeta>(),
    importProfile: (url: string, name?: string) =>
      client
        .post('profiles/import', { json: { url, name } })
        .json<ProfileMeta>(),
    activateProfile: (id: string) =>
      client.post(`profiles/${id}/activate`).json<KernelState>(),
    validateProfile: (id: string) =>
      client.post(`profiles/${id}/validate`).json<ValidateResult>(),

    // System proxy (capability-gated 'system-proxy'). GET reflects the current
    // OS proxy state; POST { enabled, bypass? } toggles it and echoes the state.
    getSysProxy: () => client.get('sysproxy').json<SystemProxyState>(),
    setSysProxy: (body: { enabled: boolean; bypass?: string[] }) =>
      client.post('sysproxy', { json: body }).json<SystemProxyState>(),
  }
}
