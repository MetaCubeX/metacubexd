<!-- packages/ui/components/OnboardingEmptyState.vue -->
<script setup lang="ts">
import { IconRocket } from '@tabler/icons-vue'

// Persistent first-run nudge shown on /overview and /proxies when the agent is
// present but NO base profile has been imported yet (the kernel is DIRECT-only,
// so there is nothing meaningful to show status about). It self-gates and
// renders NOTHING in plain web mode or while the probes are still resolving, so
// it never flashes and never clutters the dashboard once a profile exists.
//
// It deliberately does NOT read configStore.onboardingDismissed — unlike the
// one-time wizard, this banner keeps appearing after a wizard skip until a
// profile actually exists.
defineProps<{ context?: 'overview' | 'proxies' }>()

const { t } = useI18n()
const { hasAgent, hasFeature, ready: controlReady } = useControlInfo()
const { ready: profileReady, hasBaseProfile } = useProfileStatus()
const configStore = useConfigStore()
const router = useRouter()

const show = computed(
  () =>
    hasAgent.value &&
    controlReady.value &&
    hasFeature('profiles') &&
    profileReady.value &&
    !hasBaseProfile.value,
)

const goImport = () => router.push('/profiles')
// Clearing the flag re-arms the wizard gate (still requires zero base profiles,
// which is exactly the case here), so "run setup again" re-surfaces the wizard.
const reopenWizard = () => {
  configStore.onboardingDismissed = false
}
</script>

<template>
  <div
    v-if="show"
    class="ob-banner-in flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3"
  >
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
    >
      <IconRocket :size="18" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-base-content">
        {{ t('onboardingEmptyTitle') }}
      </p>
      <p class="text-xs text-base-content/60">
        {{ t('onboardingEmptyBody') }}
      </p>
    </div>
    <div class="flex items-center gap-3">
      <Button class="btn-sm btn-primary" @click="goImport">
        {{ t('onboardingEmptyImport') }}
      </Button>
      <button
        class="cursor-pointer border-none bg-transparent text-xs text-base-content/50 underline-offset-2 transition-colors duration-200 hover:text-base-content hover:underline"
        @click="reopenWizard"
      >
        {{ t('onboardingEmptyRunSetup') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ob-banner-in {
  animation: ob-banner-in 380ms var(--ease-snappy, ease-out) backwards;
}
@keyframes ob-banner-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
