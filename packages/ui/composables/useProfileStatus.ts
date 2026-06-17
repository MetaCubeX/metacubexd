// packages/ui/composables/useProfileStatus.ts
import type { ProfileMeta } from '~/types/control'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'

// Module-level singleton (mirrors useControlInfo): the shared "does any base
// profile exist?" source of truth for the first-run onboarding surfaces — the
// welcome wizard's gate and the persistent empty-state banners on /overview and
// /proxies. Web mode (no agent) NEVER lists profiles, so it does zero network
// work there; `ready` flips true in every branch so consumers never hang and
// never flash.
const ready = ref(false)
const baseProfileCount = ref(0)
const hasBaseProfile = computed(() => baseProfileCount.value > 0)
let started = false
let stopWatch: (() => void) | null = null
// Detached effect scope that OWNS the control-ready watch (see probe()). A
// module-level singleton must outlive any single component, so its watch can
// NOT be bound to whichever component's scope happened to call us first.
let scope: ReturnType<typeof effectScope> | null = null

// Re-list the agent's profiles and recount BASE profiles only — merge overlays
// and script transforms never change whether a working subscription exists.
// DOUBLE-GUARDED on the agent capability so a direct call can never hit the
// network in web mode even if a caller forgets to gate.
async function refresh(): Promise<void> {
  const { hasAgent, hasFeature } = useControlInfo()
  if (!hasAgent.value || !hasFeature('profiles')) {
    baseProfileCount.value = 0
    ready.value = true
    return
  }
  try {
    const list = await useControlApi().listProfiles()
    baseProfileCount.value = list.filter(
      (p: ProfileMeta) => p.type !== 'merge' && p.type !== 'script',
    ).length
  } catch {
    // Unreachable kernel / 401 / network error: treat as "no profile" but never
    // hang the gate. A later refresh() (after an import) re-counts.
    baseProfileCount.value = 0
  } finally {
    ready.value = true
  }
}

function probe(): void {
  if (started) return
  started = true
  // We need the control probe (hasAgent + features) settled before deciding
  // whether to list profiles at all.
  const { ready: controlReady } = useControlInfo()
  if (controlReady.value) {
    // Already settled — list now, no watch needed.
    void refresh()
    return
  }
  // Otherwise wait for the false -> true transition EXACTLY once, then tear the
  // watch (and its scope) down. Hosted in a DETACHED effectScope so the
  // singleton's watch is never disposed by the first-caller component unmounting
  // mid-probe. probe() first runs from some component's <script setup>; a watch
  // created directly there binds to THAT component's scope and dies on its
  // unmount — wedging `ready` at false forever if the control probe is still
  // pending (no later caller re-arms it, the `started` guard already tripped).
  // effectScope(true) is detached from the current component scope, so the watch
  // survives navigation. Not { immediate: true }: the immediate callback would
  // run before `stopWatch` is assigned, so the self-teardown would no-op and
  // leave the watch alive. A plain (deferred) watch guarantees stopWatch is set.
  scope = effectScope(true)
  scope.run(() => {
    stopWatch = watch(controlReady, (isReady) => {
      if (!isReady) return
      stopWatch?.()
      stopWatch = null
      scope?.stop()
      scope = null
      void refresh()
    })
  })
}

export function useProfileStatus() {
  probe()
  return { ready, hasBaseProfile, baseProfileCount, refresh }
}
