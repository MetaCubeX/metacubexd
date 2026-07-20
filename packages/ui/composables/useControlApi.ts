import type { ConfigPatchV1 } from '@metacubexd/config-editor'
import type {
  ControlInfo,
  GeoUpdateResult,
  KernelState,
  KernelVersions,
  ProfileDetail,
  ProfileEditorPreview,
  ProfileEditorSnapshot,
  ProfileMeta,
  SystemProxyState,
  TunStatus,
  ValidateResult,
  WebdavBackupResult,
  WebdavCredentials,
  WebdavRestoreResult,
} from '~/types/control'
// packages/ui/composables/useControlApi.ts
import ky from 'ky'

// Profile validation can trigger Mihomo's first-run GEO database download.
// Keep ordinary control requests on the client's 15s default. These finite
// budgets outlive the agent's 300s validator, 5s reap grace, kernel lifecycle,
// and (for refresh+apply) bounded subscription fetch (#2118, #2121).
const PROFILE_SUBSCRIPTION_TIMEOUT = 45_000
const PROFILE_VALIDATE_TIMEOUT = 330_000
const PROFILE_ACTIVATE_TIMEOUT = 360_000
const PROFILE_REFRESH_AND_ACTIVATE_TIMEOUT = 390_000

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
      ? (window as unknown as {
          metacubexd?: MetacubexdBridge
          __METACUBEXD_CONFIG__?: { controlToken?: string }
        })
      : undefined
  const bridge = w?.metacubexd?.control
  if (bridge?.base) {
    return { base: stripTrailingSlash(bridge.base), token: bridge.token }
  }
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : ''
  // All-in-One server mode: the dashboard is served same-origin with the agent,
  // and the server injects CONTROL_TOKEN into config.js so control unlocks
  // automatically (#2074). Plain static deploys leave controlToken undefined.
  const token = w?.__METACUBEXD_CONFIG__?.controlToken || undefined
  return { base: `${stripTrailingSlash(origin)}/api/control`, token }
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s
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
    // Restore the last-known-good active config (.bak from the previous
    // activate) and restart — escape hatch for a config that bricks the kernel
    // (#2109). 404s when no backup exists.
    rollbackKernel: () => client.post('kernel/rollback').json<KernelState>(),
    // Reset to a minimal (header-only) config + restart on mihomo defaults.
    // Last-resort recovery when even the backup is bad (#2109).
    recoverKernel: () => client.post('kernel/recover').json<KernelState>(),
    // EventSource cannot send Authorization headers, so the SSE route also
    // accepts ?token= (SHARED CONTRACTS). Desktop in-process binding skips
    // auth, but passing the token there is harmless.
    logsUrl: () =>
      token ? `${base}/kernel/logs?token=${token}` : `${base}/kernel/logs`,

    listProfiles: () => client.get('profiles').json<ProfileMeta[]>(),
    // `type: 'merge'` mints a YAML overlay profile (composed onto the active
    // base); `type: 'script'` mints a JS transform run after merges; omitting
    // type defaults to a plain local profile (SHARED CONTRACTS).
    createProfile: (body: {
      name: string
      content?: string
      type?: 'local' | 'merge' | 'script'
    }) => client.post('profiles', { json: body }).json<ProfileMeta>(),
    getProfile: (id: string) =>
      client.get(`profiles/${id}`).json<ProfileDetail>(),
    updateProfile: (
      id: string,
      body: {
        name?: string
        content?: string
        enabled?: boolean
        // minutes; remote-only. 0 disables auto-update.
        updateInterval?: number
      },
    ) => client.put(`profiles/${id}`, { json: body }).json<ProfileMeta>(),
    // DELETE returns 204 No Content — there is no body to parse. Chaining
    // .json() on an empty 204 throws "Unexpected end of JSON input" and makes a
    // successful delete look like a failure (#2110).
    deleteProfile: async (id: string) => {
      await client.delete(`profiles/${id}`)
    },
    duplicateProfile: (id: string, name?: string) =>
      client
        .post(`profiles/${id}/duplicate`, { json: { name } })
        .json<ProfileMeta>(),
    importProfile: (url: string, name?: string) =>
      client
        .post('profiles/import', {
          json: { url, name },
          timeout: PROFILE_SUBSCRIPTION_TIMEOUT,
        })
        .json<ProfileMeta>(),
    activateProfile: (id: string) =>
      client
        .post(`profiles/${id}/activate`, {
          timeout: PROFILE_ACTIVATE_TIMEOUT,
        })
        .json<KernelState>(),
    // Re-fetch a REMOTE subscription in place (agent overwrites content +
    // subscriptionInfo + updatedAt, keeping the same id). Pure refresh — it does
    // NOT touch the running config; use refreshAndActivateProfile to apply.
    refreshProfile: (id: string) =>
      client
        .post(`profiles/${id}/refresh`, {
          timeout: PROFILE_SUBSCRIPTION_TIMEOUT,
        })
        .json<ProfileMeta>(),
    // Combined refresh + apply: re-fetch, compose into active.yaml, validate,
    // and restart. The action users expect from "refresh and make it take
    // effect" (#2108). Returns the refreshed meta and the resulting state.
    refreshAndActivateProfile: (id: string) =>
      client
        .post(`profiles/${id}/refresh-and-activate`, {
          timeout: PROFILE_REFRESH_AND_ACTIVATE_TIMEOUT,
        })
        .json<{ meta: ProfileMeta; kernel: KernelState }>(),
    validateProfile: (id: string) =>
      client
        .post(`profiles/${id}/validate`, {
          timeout: PROFILE_VALIDATE_TIMEOUT,
        })
        .json<ValidateResult>(),

    getProfileEditor: (id: string) =>
      client.get(`profiles/${id}/editor`).json<ProfileEditorSnapshot>(),
    previewProfileEditor: (id: string, patch: ConfigPatchV1) =>
      client
        .post(`profiles/${id}/editor/preview`, { json: { patch } })
        .json<ProfileEditorPreview>(),
    applyProfileEditor: (id: string, patch: ConfigPatchV1) =>
      client
        .put(`profiles/${id}/editor`, {
          json: { patch },
          timeout: PROFILE_ACTIVATE_TIMEOUT,
        })
        .json<{
          profile: ProfileMeta
          activeId: string
          revision: string
          kernel: KernelState
        }>(),
    resetProfileEditorOverlay: (id: string) =>
      client
        .delete(`profiles/${id}/editor/overlay`, {
          timeout: PROFILE_ACTIVATE_TIMEOUT,
        })
        .json<KernelState | { ok: true }>(),

    // System proxy (capability-gated 'system-proxy'). GET reflects the current
    // OS proxy state; POST { enabled, bypass? } toggles it and echoes the state.
    getSysProxy: () => client.get('sysproxy').json<SystemProxyState>(),
    setSysProxy: (body: { enabled: boolean; bypass?: string[] }) =>
      client.post('sysproxy', { json: body }).json<SystemProxyState>(),

    // Kernel version management (capability-gated 'kernel-version'). GET lists
    // the downloaded + bundled versions and the active one; POST { version }
    // downloads/persists/live-swaps it (the kernel restarts) and echoes { ok }.
    getKernelVersions: () =>
      client.get('kernel/versions').json<KernelVersions>(),
    switchKernel: (version: string) =>
      client.post('kernel/switch', { json: { version } }).json<{ ok: true }>(),

    // Geo assets (capability-gated 'geo-assets'). POST downloads the geoip/
    // geosite/mmdb databases into the kernel home dir and echoes { ok, files }.
    updateGeoAssets: () => client.post('geo/update').json<GeoUpdateResult>(),

    // Runtime config viewer (capability-gated 'runtime-config'). GET returns the
    // ACTUAL config file the kernel runs with -f as text/yaml (it carries the
    // supervisor-injected external-controller/secret/mixed-port), so it is read
    // as text — not JSON. Missing file resolves to ''.
    getRuntimeConfig: () => client.get('config/runtime').text(),

    // Config sections (capability-gated 'config-sections'). GET reads ONE parsed
    // top-level key of the active profile (e.g. rules, dns, sniffer) — resolves
    // to null when absent / no active profile. PUT { key, value } replaces that
    // section, re-activates the profile and restarts the kernel ONCE (so a GUI
    // editor batches every local edit into a single save). PUT echoes the
    // restarted KernelState. SHARED CONTRACTS.
    getConfigSection: <T = unknown>(key: string) =>
      client.get('config/section', { searchParams: { key } }).json<T>(),
    // `restart: false` persists the section to the active profile without
    // restarting the kernel — used when the change was already hot-applied via
    // PATCH /configs and only needs to survive the next restart (#2070).
    setConfigSection: (body: {
      key: string
      value: unknown
      restart?: boolean
    }) => client.put('config/section', { json: body }).json<KernelState>(),

    // WebDAV backup/restore (capability-gated 'webdav-backup'). Credentials are
    // sent per-request and never persisted by the agent. Backup ships every
    // profile plus the UI settings snapshot; restore recreates the profiles and
    // echoes the stored uiSettings for the UI to re-apply.
    webdavBackup: (body: { webdav: WebdavCredentials; uiSettings?: unknown }) =>
      client.post('backup', { json: body }).json<WebdavBackupResult>(),
    webdavRestore: (body: { webdav: WebdavCredentials }) =>
      client.post('restore', { json: body }).json<WebdavRestoreResult>(),

    // TUN mode (capability-gated 'tun'). GET reflects the current sidecar/tun
    // state; POST { enabled, stack? } toggles it and echoes the same TunStatus.
    // Enabling installs/elevates the privileged helper and privileged-restarts
    // mihomo (slow); disabling tears TUN down and returns to the sidecar — it
    // doubles as the "recover network" escape hatch (SHARED CONTRACTS).
    getTun: () => client.get('tun').json<TunStatus>(),
    setTun: (body: { enabled: boolean; stack?: string }) =>
      client.post('tun', { json: body }).json<TunStatus>(),
    // Remove the privileged helper service entirely (tears TUN down to the
    // sidecar first if active). Echoes the post-uninstall TunStatus.
    uninstallTun: () => client.post('tun/uninstall').json<TunStatus>(),
  }
}
