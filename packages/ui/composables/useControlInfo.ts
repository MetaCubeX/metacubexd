// packages/ui/composables/useControlInfo.ts
import type { ControlFeature, ControlInfo } from '~/types/control'
import { useControlApi } from './useControlApi'

// Module-level singleton: probe /api/control/info exactly once per page load.
const hasAgent = ref(false)
const features = ref<ControlFeature[]>([])
const info = ref<ControlInfo | null>(null)
const ready = ref(false)
let started = false

function probe() {
  if (started) return
  started = true
  const api = useControlApi()
  api
    .getInfo()
    .then((res) => {
      info.value = res
      hasAgent.value = res.hasAgent === true
      features.value = Array.isArray(res.features) ? res.features : []
    })
    .catch(() => {
      // 404 or network error => plain remote panel mode (today's behaviour).
      hasAgent.value = false
      features.value = []
      info.value = null
    })
    .finally(() => {
      ready.value = true
    })
}

export function useControlInfo() {
  probe()
  const hasFeature = (f: ControlFeature) =>
    hasAgent.value && features.value.includes(f)
  return { hasAgent, features, info, ready, hasFeature }
}
