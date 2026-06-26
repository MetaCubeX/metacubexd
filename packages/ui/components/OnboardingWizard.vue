<!-- packages/ui/components/OnboardingWizard.vue -->
<script setup lang="ts">
import type { ProfileMeta } from '~/types/control'
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconDeviceDesktop,
  IconRocket,
} from '@tabler/icons-vue'

// One-time first-run welcome wizard (desktop/server agent mode only). Mounted
// once in layouts/default.vue. It self-gates: renders NOTHING in plain web mode
// and during the async capability/profile probes, so /overview paints normally
// (秒开 preserved) and the wizard fades in afterward only when warranted —
// agent present, profiles feature available, zero base profiles, not yet
// dismissed. Completing OR skipping persists onboardingDismissed so it never
// reappears (the persistent empty-state banners keep nudging instead).
const { t } = useI18n()
const { hasAgent, hasFeature, ready: controlReady } = useControlInfo()
const {
  ready: profileReady,
  hasBaseProfile,
  refresh: refreshProfileStatus,
} = useProfileStatus()
const configStore = useConfigStore()
const router = useRouter()
const api = useControlApi()
const systemProxy = useSystemProxy()
const shortcutsStore = useShortcutsStore()

// Accessible name for the dialog. Exactly one step renders at a time, so all
// step <h1>s safely share this id (see :id="titleId" on each heading).
const titleId = useId()
const cardRef = ref<HTMLElement | null>(null)

const showWizard = computed(
  () =>
    hasAgent.value &&
    controlReady.value &&
    hasFeature('profiles') &&
    profileReady.value &&
    !hasBaseProfile.value &&
    !configStore.onboardingDismissed,
)

// Local visibility so the exit transition can play before the gate itself flips
// false (a successful import sets hasBaseProfile=true, which would otherwise
// yank the overlay before the "done" step shows). Only the gate turns it ON;
// only an explicit dismiss/finish turns it OFF.
const visible = ref(false)
// Auto-advance timer for the post-import beat (cleared on unmount / re-arm).
let advanceTimer: ReturnType<typeof setTimeout> | null = null

// The optional system-proxy step is dropped where the capability is absent
// (e.g. a Linux/Docker server), collapsing the flow to welcome -> import -> done.
const hasSystemProxyStep = computed(() => systemProxy.available.value)
type StepKey = 'welcome' | 'import' | 'systemProxy' | 'done'
const steps = computed<StepKey[]>(() => {
  const list: StepKey[] = ['welcome', 'import']
  if (hasSystemProxyStep.value) list.push('systemProxy')
  list.push('done')
  return list
})
const stepIndex = ref(0)
const currentStep = computed<StepKey>(
  () => steps.value[stepIndex.value] ?? 'welcome',
)
const totalSteps = computed(() => steps.value.length)

const importSuccess = ref(false)

// Show the wizard when the gate opens, resetting to the first step each time so
// a reopen (via the empty-state "run setup again") never resumes on a stale
// step. Only the gate turns `visible` ON; only dismiss/finish turns it OFF (so
// the exit transition can play after a successful import flips the gate false).
// Declared after stepIndex/importSuccess so the immediate run never touches an
// uninitialized ref.
watch(
  showWizard,
  (v) => {
    if (!v) return
    stepIndex.value = 0
    importSuccess.value = false
    visible.value = true
  },
  { immediate: true },
)

// While shown, the wizard owns the keyboard (suppresses the global r/g
// shortcuts via the store flag) and pulls initial focus for a11y.
watch(
  visible,
  (v) => {
    shortcutsStore.isOnboardingOpen = v
    if (v) nextTick(() => cardRef.value?.focus())
  },
  { immediate: true },
)

const next = () => {
  if (stepIndex.value < steps.value.length - 1) stepIndex.value++
}
const back = () => {
  if (stepIndex.value > 0) stepIndex.value--
}

const dismiss = () => {
  // Kill any pending auto-advance so a skip/finish within the post-import beat
  // cannot fire next() into a hidden (or later-reopened) wizard.
  if (advanceTimer) {
    clearTimeout(advanceTimer)
    advanceTimer = null
  }
  configStore.onboardingDismissed = true
  visible.value = false
}

const onImported = async (meta: ProfileMeta) => {
  importSuccess.value = true
  try {
    // Activate immediately so the freshly imported subscription is LIVE — the
    // "working proxy in under a minute" goal. On a fresh install there are no
    // live connections, so the activation's connection reset is a no-op.
    await api.activateProfile(meta.id)
  } catch {
    // Activation failure is surfaced by the hero's own toast; still advance —
    // the profile exists now, so the gate would hide the wizard regardless.
  }
  await refreshProfileStatus()
  // Auto-advance after a beat so the success state is visible.
  if (advanceTimer) clearTimeout(advanceTimer)
  advanceTimer = setTimeout(() => {
    advanceTimer = null
    next()
  }, 800)
}

const finish = () => dismiss()
const goToProxies = () => {
  dismiss()
  router.push('/proxies')
}

// Load the live system-proxy state when (and only when) that step is reached.
watch(currentStep, (step) => {
  if (step === 'systemProxy') systemProxy.load()
})

// Escape skips the wizard (the backdrop is intentionally NOT click-dismissable).
// The global shortcut handler is suppressed while we are open, so this is the
// sole Escape handler in effect.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (visible.value && e.key === 'Escape') {
    e.preventDefault()
    dismiss()
  }
})

onUnmounted(() => {
  if (advanceTimer) clearTimeout(advanceTimer)
  shortcutsStore.isOnboardingOpen = false
})
</script>

<template>
  <Teleport to="body">
    <Transition name="ob-overlay">
      <div
        v-if="visible"
        class="fixed inset-0 z-[80] flex items-center justify-center p-4"
      >
        <!-- Backdrop (NOT dismissable by click — first-run owns the screen) -->
        <div class="ob-backdrop absolute inset-0" aria-hidden="true" />

        <div
          ref="cardRef"
          class="ob-card relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 shadow-2xl"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <!-- Step indicator -->
          <div
            class="flex items-center justify-between border-b border-base-content/8 bg-base-200/60 px-5 py-3"
          >
            <span
              class="text-[0.6875rem] font-semibold tracking-[0.05em] text-base-content/50 uppercase"
            >
              {{
                t('onboardingStep', {
                  current: stepIndex + 1,
                  total: totalSteps,
                })
              }}
            </span>
            <div class="flex items-center gap-1.5">
              <span
                v-for="(s, i) in steps"
                :key="s"
                class="h-1.5 rounded-full transition-all duration-300"
                :class="
                  i === stepIndex
                    ? 'w-5 bg-primary'
                    : i < stepIndex
                      ? 'w-1.5 bg-primary/50'
                      : 'w-1.5 bg-base-content/20'
                "
              />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <!-- Step: Welcome -->
            <div
              v-if="currentStep === 'welcome'"
              class="flex flex-col items-center gap-5 py-4 text-center"
            >
              <div
                class="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-secondary text-primary-content"
              >
                <IconRocket :size="32" />
              </div>
              <div>
                <h1 :id="titleId" class="text-2xl font-bold tracking-tight">
                  {{ t('onboardingWelcomeTitle') }}
                </h1>
                <p class="mx-auto mt-2 max-w-sm text-sm text-base-content/60">
                  {{ t('onboardingWelcomeBody') }}
                </p>
              </div>
              <Button
                class="btn w-full max-w-xs btn-primary"
                :icon="IconArrowRight"
                @click="next"
              >
                {{ t('onboardingGetStarted') }}
              </Button>
            </div>

            <!-- Step: Import subscription (centerpiece) -->
            <div
              v-else-if="currentStep === 'import'"
              class="flex flex-col gap-4"
            >
              <div>
                <h1 :id="titleId" class="text-xl font-bold tracking-tight">
                  {{ t('onboardingImportTitle') }}
                </h1>
                <p class="mt-1 text-sm text-base-content/60">
                  {{ t('onboardingImportSubtitle') }}
                </p>
              </div>
              <ProfileImportHero variant="wizard" @imported="onImported" />
              <div
                v-if="importSuccess"
                class="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
              >
                <IconCircleCheck :size="18" />
                {{ t('onboardingImportSuccess') }}
              </div>
            </div>

            <!-- Step: Optional system proxy -->
            <div
              v-else-if="currentStep === 'systemProxy'"
              class="flex flex-col gap-5 py-2"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"
              >
                <IconDeviceDesktop :size="24" />
              </div>
              <div>
                <h1 :id="titleId" class="text-xl font-bold tracking-tight">
                  {{ t('onboardingSystemProxyTitle') }}
                </h1>
                <p class="mt-1 text-sm text-base-content/60">
                  {{ t('onboardingSystemProxyBody') }}
                </p>
              </div>
              <label
                class="flex cursor-pointer items-center justify-between rounded-xl border border-base-content/10 bg-base-200 p-4"
              >
                <span class="font-medium text-base-content">
                  {{ t('onboardingSystemProxyTitle') }}
                </span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  :checked="systemProxy.enabled.value"
                  :disabled="systemProxy.loading.value"
                  :aria-label="t('onboardingSystemProxyTitle')"
                  @change="
                    systemProxy.toggle(
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
              </label>
            </div>

            <!-- Step: Done -->
            <div
              v-else
              class="flex flex-col items-center gap-5 py-4 text-center"
            >
              <div
                class="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success"
              >
                <IconCircleCheck :size="36" />
              </div>
              <div>
                <h1 :id="titleId" class="text-2xl font-bold tracking-tight">
                  {{ t('onboardingDoneTitle') }}
                </h1>
                <p class="mx-auto mt-2 max-w-sm text-sm text-base-content/60">
                  {{ t('onboardingDoneBody') }}
                </p>
              </div>
            </div>
          </div>

          <!-- Footer actions -->
          <div
            class="flex items-center justify-between gap-2 border-t border-base-content/8 bg-base-200/60 px-5 py-3"
          >
            <!-- Left: Back (mid-flow) or empty -->
            <Button
              v-if="stepIndex > 0 && currentStep !== 'done'"
              class="btn-ghost btn-sm"
              :icon="IconArrowLeft"
              @click="back"
            >
              {{ t('onboardingBack') }}
            </Button>
            <span v-else />

            <!-- Right: step-specific primary + skip -->
            <div class="flex items-center gap-3">
              <template v-if="currentStep === 'welcome'">
                <button class="ob-skip" @click="dismiss">
                  {{ t('onboardingSkip') }}
                </button>
              </template>
              <template v-else-if="currentStep === 'import'">
                <button class="ob-skip" @click="dismiss">
                  {{ t('onboardingSkip') }}
                </button>
              </template>
              <template v-else-if="currentStep === 'systemProxy'">
                <Button class="btn-sm btn-primary" @click="next">
                  {{ t('onboardingNext') }}
                </Button>
              </template>
              <template v-else>
                <button class="ob-skip" @click="finish">
                  {{ t('onboardingFinish') }}
                </button>
                <Button class="btn-sm btn-primary" @click="goToProxies">
                  {{ t('onboardingGoToProxies') }}
                </Button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ob-backdrop {
  background: oklch(0% 0 0 / 0.55);
}

/* Card entrance reuses the Modal.vue motion vocabulary (composited transform +
   opacity, spring settle). */
.ob-card {
  transition:
    opacity var(--dur-base, 220ms) var(--ease-soft, ease),
    transform var(--dur-slow, 320ms) var(--ease-spring, ease);
  will-change: transform, opacity;
}

.ob-overlay-enter-from .ob-card,
.ob-overlay-leave-to .ob-card {
  opacity: 0;
  transform: translateY(16px) scale(0.94);
}
.ob-overlay-enter-from .ob-backdrop,
.ob-overlay-leave-to .ob-backdrop {
  opacity: 0;
}
.ob-overlay-enter-active,
.ob-overlay-leave-active {
  transition: opacity var(--dur-base, 220ms) var(--ease-soft, ease);
}
.ob-backdrop {
  transition: opacity var(--dur-base, 220ms) var(--ease-soft, ease);
}

/* Subtle ghost "skip/finish" text link */
.ob-skip {
  cursor: pointer;
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
  transition: color var(--dur-fast, 150ms) var(--ease-soft, ease);
}
.ob-skip:hover {
  color: var(--color-base-content);
}
</style>
