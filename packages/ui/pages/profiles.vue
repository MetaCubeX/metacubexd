<!-- packages/ui/pages/profiles.vue -->
<script setup lang="ts">
import type { ProfileMeta } from '~/types/control'
import {
  IconBraces,
  IconCopy,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconQrcode,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import { onControlInvalidate } from '~/composables/useControlSync'
import { controlErrorMessage } from '~/utils/controlError'

const { t, locale } = useI18n()
const router = useRouter()
const { hasFeature, ready } = useControlInfo()
const kernelStore = useKernelStore()
const { isShareable, qrSvg } = useShareQr()
const { copy: copyToClipboard } = useClipboard()

useHead({ title: computed(() => t('profiles')) })

// Lazy => monaco lands in its own async chunk, off the main bundle.
const MonacoYamlEditor = defineAsyncComponent(
  () => import('~/components/MonacoYamlEditor.client.vue'),
)

const {
  profiles,
  baseProfiles,
  mergeProfiles,
  scriptProfiles,
  activeBaseId,
  loading,
  refresh,
  create,
  createMerge,
  createScript,
  duplicate,
  remove,
  refreshRemote,
  refreshAndApply,
  save,
  saveMerge,
  saveScript,
  setEnabled,
  setScriptEnabled,
  setUpdateInterval,
  load,
  validate,
  activate,
} = useProfiles()

// Per-action loading: each button reflects only its own in-flight state (keyed
// `action:id`) instead of one global `busy` flag greying every control.
const { isBusy, run: withBusy } = useBusyKeys()

const newName = ref('')
const newMergeName = ref('')
const newScriptName = ref('')

const editingId = ref<string | null>(null)
// Name + kind of the profile currently open in the editor, for the editor's
// header (so it is clear WHICH profile is being edited).
const editingName = ref('')
// The editor wrapper, scrolled into view AND focused when an editor opens (it
// mounts at the bottom of a potentially long page — otherwise clicking Edit
// looks inert, and keyboard/SR users get no signal it opened).
const editorPanelRef = ref<HTMLElement | null>(null)
// Labels the editor region (aria-labelledby) so focusing it announces which
// profile is being edited.
const editorHeadingId = useId()
// Whether the open editor targets a merge overlay — drives save-vs-recompose.
const editingMerge = ref(false)
// Whether the open editor targets a script transform — drives the JS editor
// language and routes save through saveScript (which recomposes).
const editingScript = ref(false)
const editingText = ref('')
const validationMessage = ref('')
const validationOk = ref<boolean | null>(null)

onMounted(() => {
  if (hasFeature('profiles'))
    refresh().catch((err) => {
      console.error('[profiles] initial load failed', err)
      toast.error(t('profilesActionFailed'), {
        description: controlErrorMessage(err),
      })
    })
})

// Re-sync the active marker + list when a profile is activated from outside the
// SPA (tray submenu, AIO scheduler). desktop-sync invalidates vue-query caches,
// but this list lives in a local ref, so reload it on backend invalidate. A
// no-op on web builds (no bridge). (#2148)
onControlInvalidate(() => {
  if (hasFeature('profiles')) void refresh()
})

// Uniform failure feedback for the actions whose composable methods rethrow
// (the merge/script setters self-toast and never reach here).
const notifyError = (e: unknown) =>
  toast.error(t('profilesActionFailed'), {
    description: controlErrorMessage(e),
  })

// Honour prefers-reduced-motion for the one-shot editor scroll: a JS
// scrollIntoView with an explicit behavior overrides the CSS reduced-motion
// rule, so gate it here (mirrors Modal.vue's motion gating).
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const openEditor = (
  id: string,
  name: string,
  kind: 'base' | 'merge' | 'script' = 'base',
) =>
  withBusy(`edit:${id}`, async () => {
    try {
      const detail = await load(id)
      editingText.value = detail.content
      editingId.value = id
      editingName.value = name
      editingMerge.value = kind === 'merge'
      editingScript.value = kind === 'script'
      validationMessage.value = ''
      validationOk.value = null
      // The editor mounts at the bottom of the page; pull it into view AND move
      // focus there so an Edit click above the fold visibly (and, for keyboard /
      // screen-reader users, audibly via the labelled region) does something.
      await nextTick()
      editorPanelRef.value?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      })
      editorPanelRef.value?.focus({ preventScroll: true })
    } catch (e) {
      notifyError(e)
    }
  })

const closeEditor = () => {
  editingId.value = null
  editingName.value = ''
  editingMerge.value = false
  editingScript.value = false
  editingText.value = ''
}

const onSave = () => {
  if (!editingId.value) return
  const id = editingId.value
  return withBusy('editor-save', async () => {
    try {
      // Editing a merge overlay or script transform re-composes the active base
      // after saving (those setters self-toast on failure); a plain base profile
      // just saves its content and rethrows, so we surface that here.
      if (editingScript.value) {
        await saveScript(id, editingText.value)
      } else if (editingMerge.value) {
        await saveMerge(id, editingText.value)
      } else {
        await save(id, editingText.value)
      }
    } catch (e) {
      notifyError(e)
    }
  })
}

const onValidate = () => {
  if (!editingId.value) return
  const id = editingId.value
  return withBusy('editor-validate', async () => {
    try {
      await save(id, editingText.value)
      const res = await validate(id)
      validationOk.value = res.valid
      validationMessage.value = res.valid
        ? t('profilesValidationOk')
        : res.message
    } catch (e) {
      // Never leave a prior run's verdict on screen after a failed save/validate.
      validationOk.value = null
      validationMessage.value = ''
      notifyError(e)
    }
  })
}

const onActivate = (id: string) => {
  // Re-activating the already-active base would pointlessly restart the kernel
  // AND drop every live connection (activate() closes them). Skip it.
  if (id === activeBaseId.value) return
  return withBusy(`activate:${id}`, async () => {
    try {
      const state = await activate(id)
      kernelStore.state = state
      toast.success(t('profilesActivated'))
    } catch (e) {
      notifyError(e)
    }
  })
}

const onCreate = () => {
  if (!newName.value.trim()) return
  return withBusy('create', async () => {
    try {
      await create({ name: newName.value.trim() })
      newName.value = ''
      // A new base profile changes the onboarding "do we have a subscription?"
      // signal consumed by the wizard gate + empty-state banners.
      await useProfileStatus().refresh()
    } catch (e) {
      notifyError(e)
    }
  })
}

const onCreateMerge = () => {
  if (!newMergeName.value.trim()) return
  return withBusy('createMerge', async () => {
    try {
      await createMerge(newMergeName.value.trim())
      newMergeName.value = ''
    } catch (e) {
      notifyError(e)
    }
  })
}

const onCreateScript = () => {
  if (!newScriptName.value.trim()) return
  return withBusy('createScript', async () => {
    try {
      await createScript(newScriptName.value.trim())
      newScriptName.value = ''
    } catch (e) {
      notifyError(e)
    }
  })
}

const onToggleMerge = (id: string, event: Event) => {
  const next = (event.target as HTMLInputElement).checked
  return withBusy(`toggle:${id}`, () => setEnabled(id, next))
}

const onToggleScript = (id: string, event: Event) => {
  const next = (event.target as HTMLInputElement).checked
  return withBusy(`toggle:${id}`, () => setScriptEnabled(id, next))
}

// The prominent import hero (ProfileImportHero) owns the actual import; it runs
// its own useProfiles + refreshes the shared profile-status singleton. Refresh
// THIS page's per-instance list too so the base-profile grid below updates.
const onHeroImported = async () => {
  await refresh()
}

const onRefresh = (id: string) =>
  // refreshRemote toasts its own success/failure (incl. the "not remote" case).
  withBusy(`refresh:${id}`, () => refreshRemote(id))

// Refresh + apply: re-fetch the subscription and re-compose + restart so the
// new nodes actually route (#2108). Separate from onRefresh, which only updates
// storage. refreshAndApply toasts its own success/failure.
const onRefreshAndApply = (id: string) =>
  withBusy(`refresh-apply:${id}`, () => refreshAndApply(id))

// Preset auto-update intervals (minutes). 0 disables; the AIO server scheduler
// refreshes remote profiles whose interval has elapsed and re-activates the
// active one so the new subscription takes effect (#2107). Desktop also ticks,
// notifying on each refresh (apply stays manual there).
const UPDATE_INTERVAL_PRESETS = [0, 30, 60, 360, 720, 1440] as const

const onUpdateInterval = (p: ProfileMeta, event: Event) => {
  const minutes = Number((event.target as HTMLSelectElement).value)
  return withBusy(`interval:${p.id}`, async () => {
    try {
      await setUpdateInterval(p.id, minutes)
    } catch (e) {
      notifyError(e)
    }
  })
}

const onDuplicate = (p: ProfileMeta) =>
  withBusy(`duplicate:${p.id}`, async () => {
    try {
      await duplicate(p.id, `${p.name} copy`)
    } catch (e) {
      notifyError(e)
    }
  })

const onRemove = (id: string) => {
  // Deletion is irreversible (recovery = re-import + re-fetch); deleting the
  // ACTIVE base also tears down the running config — warn harder there.
  const name =
    profiles.value.find((p) => p.id === id)?.name ?? t('profilesName')
  const message =
    id === activeBaseId.value
      ? t('profilesDeleteActiveConfirm', { name })
      : t('profilesDeleteConfirm', { name })
  if (!confirm(message)) return
  return withBusy(`delete:${id}`, async () => {
    try {
      await remove(id)
      if (editingId.value === id) closeEditor()
      // Deleting the LAST base profile must re-surface the onboarding banners/wizard.
      await useProfileStatus().refresh()
    } catch (e) {
      notifyError(e)
    }
  })
}

// Subscription QR sharing (remote profiles only). The dialog renders the
// profile url as a scannable QR plus a copy-url affordance.
const shareModalRef = ref<{ open: () => void; close: () => void } | null>(null)
const shareUrl = ref('')
const shareName = ref('')
const shareSvg = computed(() => qrSvg(shareUrl.value))

const onShare = (p: ProfileMeta) => {
  if (!isShareable(p) || !p.url) return
  shareUrl.value = p.url
  shareName.value = p.name
  shareModalRef.value?.open()
}

const onCopyShareUrl = async () => {
  if (!shareUrl.value) return
  await copyToClipboard(shareUrl.value)
  toast.success(t('profilesShareCopied'))
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-y-auto p-2">
    <!-- No-agent fallback: page renders nothing useful; keep an empty guard. -->
    <div
      v-if="ready && !hasFeature('profiles')"
      class="flex h-full items-center justify-center text-base-content/60"
    >
      {{ t('profilesEmpty') }}
    </div>

    <template v-else>
      <!-- Prominent subscription import (shared with the first-run wizard) -->
      <ProfileImportHero @imported="onHeroImported" />

      <!-- Profile list -->
      <div v-if="loading" class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          v-for="i in 4"
          :key="i"
          class="h-28 animate-pulse rounded-xl bg-base-content/5"
        />
      </div>
      <div
        v-else-if="profiles.length === 0"
        class="text-center text-base-content/60"
      >
        {{ t('profilesEmpty') }}
      </div>
      <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          v-for="p in baseProfiles"
          :key="p.id"
          class="rounded-xl border bg-base-200 p-4"
          :class="
            p.id === activeBaseId
              ? 'border-success/40'
              : 'border-base-content/10'
          "
          :aria-current="p.id === activeBaseId ? 'true' : undefined"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="min-w-0 truncate font-semibold">{{ p.name }}</span>
            <div class="flex shrink-0 items-center gap-1.5">
              <span
                v-if="p.id === activeBaseId"
                class="badge badge-sm badge-success"
              >
                {{ t('profilesActive') }}
              </span>
              <span
                v-if="p.editorStatus === 'conflicted'"
                class="badge badge-sm badge-warning"
              >
                {{ t('visualEditorConflicts') }}
              </span>
              <span class="badge badge-ghost badge-sm">{{ p.type }}</span>
            </div>
          </div>

          <p class="mt-0.5 text-xs text-base-content/50">
            {{
              t('profilesUpdated', {
                time: formatTimeFromNow(p.updatedAt, locale),
              })
            }}
          </p>

          <SubscriptionUsageCard :info="p.subscriptionInfo" />

          <!-- Auto-update interval (remote only). The AIO server ticks every
               minute and refreshes remote profiles whose interval elapsed; a
               refreshed active profile re-activates so the new subscription
               routes immediately (#2107). -->
          <div
            v-if="p.type === 'remote'"
            class="mt-2 flex items-center gap-2 text-sm"
          >
            <label
              class="text-base-content/60"
              :for="`update-interval-${p.id}`"
            >
              {{ t('profilesAutoUpdate') }}
            </label>
            <select
              :id="`update-interval-${p.id}`"
              class="select-bordered select flex-1 select-xs"
              :value="p.updateInterval ?? 0"
              :disabled="isBusy(`interval:${p.id}`)"
              @change="onUpdateInterval(p, $event)"
            >
              <option v-for="m in UPDATE_INTERVAL_PRESETS" :key="m" :value="m">
                {{
                  m === 0
                    ? t('profilesAutoUpdateOff')
                    : m < 60
                      ? t('profilesAutoUpdateMinutes', { n: m })
                      : t('profilesAutoUpdateHours', { n: m / 60 })
                }}
              </option>
            </select>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <Button
              v-if="hasFeature('visual-config-editor')"
              class="btn-primary btn-xs"
              :icon="IconBraces"
              @click="router.push(`/profiles/${p.id}/edit`)"
            >
              {{ t('visualEditor') }}
            </Button>
            <Button
              class="btn-xs"
              :icon="IconPencil"
              :loading="isBusy(`edit:${p.id}`)"
              @click="openEditor(p.id, p.name)"
            >
              {{ t('profilesEdit') }}
            </Button>
            <Button
              v-if="p.type === 'remote'"
              class="btn-xs"
              :icon="IconRefresh"
              :loading="isBusy(`refresh:${p.id}`)"
              @click="onRefresh(p.id)"
            >
              {{ t('profilesRefresh') }}
            </Button>
            <Button
              v-if="p.type === 'remote'"
              class="btn-success btn-xs"
              :icon="IconRefresh"
              :loading="isBusy(`refresh-apply:${p.id}`)"
              @click="onRefreshAndApply(p.id)"
            >
              {{ t('profilesRefreshAndApply') }}
            </Button>
            <Button
              class="btn-xs"
              :icon="IconCopy"
              :loading="isBusy(`duplicate:${p.id}`)"
              @click="onDuplicate(p)"
            >
              {{ t('profilesDuplicate') }}
            </Button>
            <Button
              v-if="p.id !== activeBaseId"
              class="btn-success btn-xs"
              :icon="IconPlayerPlay"
              :loading="isBusy(`activate:${p.id}`)"
              @click="onActivate(p.id)"
            >
              {{ t('profilesActivate') }}
            </Button>
            <Button
              v-if="isShareable(p)"
              class="btn-xs"
              :icon="IconQrcode"
              @click="onShare(p)"
            >
              {{ t('profilesShare') }}
            </Button>
            <Button
              class="btn-error btn-xs"
              :icon="IconTrash"
              :loading="isBusy(`delete:${p.id}`)"
              @click="onRemove(p.id)"
            >
              {{ t('profilesDelete') }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Advanced: blank profiles, merge overlays, script transforms.
           Demoted into a collapsed disclosure so the import hero stays the
           primary action on a fresh install. -->
      <details
        class="rounded-xl border border-base-content/10 bg-base-200/40 p-3"
      >
        <summary
          class="cursor-pointer text-sm font-semibold text-base-content/70"
        >
          {{ t('profilesAdvanced') }}
        </summary>
        <div class="mt-4 flex flex-col gap-6">
          <!-- New blank (local) profile -->
          <div class="flex items-end gap-2">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-base-content/60">{{ t('profilesName') }}</span>
              <input
                v-model="newName"
                class="input-bordered input input-sm"
                :placeholder="t('profilesNew')"
              />
            </label>
            <Button
              class="btn-primary btn-sm"
              :icon="IconPlus"
              :loading="isBusy('create')"
              @click="onCreate"
            >
              {{ t('profilesNew') }}
            </Button>
          </div>

          <!-- Merge overlays: composed onto the active base when enabled. -->
          <section class="flex flex-col gap-3">
            <div class="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 class="font-semibold text-base-content">
                  {{ t('profilesMerges') }}
                </h2>
                <p class="max-w-prose text-sm text-base-content/60">
                  {{ t('profilesMergesHelp') }}
                </p>
              </div>
              <div class="flex items-end gap-2">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-base-content/60">{{
                    t('profilesName')
                  }}</span>
                  <input
                    v-model="newMergeName"
                    class="input-bordered input input-sm"
                    :placeholder="t('profilesNewMerge')"
                  />
                </label>
                <Button
                  class="btn-primary btn-sm"
                  :icon="IconPlus"
                  :loading="isBusy('createMerge')"
                  @click="onCreateMerge"
                >
                  {{ t('profilesNewMerge') }}
                </Button>
              </div>
            </div>

            <div
              v-if="mergeProfiles.length"
              class="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              <div
                v-for="m in mergeProfiles"
                :key="m.id"
                class="rounded-xl border border-base-content/10 bg-base-200 p-4"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="flex min-w-0 items-center gap-2 font-semibold">
                    <span class="truncate">{{ m.name }}</span>
                    <span
                      v-if="m.managedBy === 'visual-editor'"
                      class="badge badge-xs badge-primary"
                    >
                      {{ t('visualEditorManaged') }}
                    </span>
                  </span>
                  <label class="flex items-center gap-2 text-sm">
                    <span class="text-base-content/60">{{
                      t('profilesMergeEnabled')
                    }}</span>
                    <input
                      type="checkbox"
                      class="toggle toggle-primary toggle-sm"
                      :checked="m.enabled !== false"
                      :disabled="
                        isBusy(`toggle:${m.id}`) ||
                        m.managedBy === 'visual-editor'
                      "
                      :aria-label="t('profilesMergeEnabled')"
                      @change="onToggleMerge(m.id, $event)"
                    />
                  </label>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <Button
                    v-if="m.managedBy !== 'visual-editor'"
                    class="btn-xs"
                    :icon="IconPencil"
                    :loading="isBusy(`edit:${m.id}`)"
                    @click="openEditor(m.id, m.name, 'merge')"
                  >
                    {{ t('profilesEdit') }}
                  </Button>
                  <Button
                    class="btn-error btn-xs"
                    :icon="IconTrash"
                    :loading="isBusy(`delete:${m.id}`)"
                    @click="onRemove(m.id)"
                  >
                    {{ t('profilesDelete') }}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <!-- Script transforms: JS run after merges during composition. -->
          <section class="flex flex-col gap-3">
            <div class="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 class="font-semibold text-base-content">
                  {{ t('profilesScripts') }}
                </h2>
                <p class="max-w-prose text-sm text-base-content/60">
                  {{ t('profilesScriptsHelp') }}
                </p>
                <p class="mt-1 max-w-prose text-sm text-warning">
                  {{ t('profilesScriptsSafety') }}
                </p>
              </div>
              <div class="flex items-end gap-2">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="text-base-content/60">{{
                    t('profilesName')
                  }}</span>
                  <input
                    v-model="newScriptName"
                    class="input-bordered input input-sm"
                    :placeholder="t('profilesNewScript')"
                  />
                </label>
                <Button
                  class="btn-primary btn-sm"
                  :icon="IconPlus"
                  :loading="isBusy('createScript')"
                  @click="onCreateScript"
                >
                  {{ t('profilesNewScript') }}
                </Button>
              </div>
            </div>

            <div
              v-if="scriptProfiles.length"
              class="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              <div
                v-for="s in scriptProfiles"
                :key="s.id"
                class="rounded-xl border border-base-content/10 bg-base-200 p-4"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold">{{ s.name }}</span>
                  <label class="flex items-center gap-2 text-sm">
                    <span class="text-base-content/60">{{
                      t('profilesScriptEnabled')
                    }}</span>
                    <input
                      type="checkbox"
                      class="toggle toggle-primary toggle-sm"
                      :checked="s.enabled !== false"
                      :disabled="isBusy(`toggle:${s.id}`)"
                      :aria-label="t('profilesScriptEnabled')"
                      @change="onToggleScript(s.id, $event)"
                    />
                  </label>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <Button
                    class="btn-xs"
                    :icon="IconPencil"
                    :loading="isBusy(`edit:${s.id}`)"
                    @click="openEditor(s.id, s.name, 'script')"
                  >
                    {{ t('profilesEdit') }}
                  </Button>
                  <Button
                    class="btn-error btn-xs"
                    :icon="IconTrash"
                    :loading="isBusy(`delete:${s.id}`)"
                    @click="onRemove(s.id)"
                  >
                    {{ t('profilesDelete') }}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </details>

      <!-- Editor -->
      <div
        v-if="editingId"
        ref="editorPanelRef"
        class="rounded-xl border border-base-content/10 bg-base-200 p-4"
        role="region"
        :aria-labelledby="editorHeadingId"
        tabindex="-1"
      >
        <!-- Identity header: which profile + kind is open. The kind badge is
             only meaningful for overlays/transforms, so a plain base profile
             shows just its name. -->
        <div :id="editorHeadingId" class="mb-3 flex items-center gap-2">
          <IconPencil :size="16" class="shrink-0 text-base-content/60" />
          <span class="min-w-0 truncate font-semibold">
            {{ t('profilesEditing', { name: editingName }) }}
          </span>
          <span
            v-if="editingMerge || editingScript"
            class="badge shrink-0 badge-ghost badge-sm"
          >
            {{ editingScript ? t('profilesScripts') : t('profilesMerges') }}
          </span>
        </div>

        <ClientOnly>
          <MonacoYamlEditor
            v-model="editingText"
            :language="editingScript ? 'javascript' : 'yaml'"
          />
        </ClientOnly>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button
            class="btn-primary btn-sm"
            :loading="isBusy('editor-save')"
            @click="onSave"
          >
            {{ t('profilesSave') }}
          </Button>
          <Button
            v-if="!editingScript"
            class="btn-sm"
            :loading="isBusy('editor-validate')"
            @click="onValidate"
          >
            {{ t('profilesValidate') }}
          </Button>
          <Button class="btn-ghost btn-sm" @click="closeEditor">
            {{ t('profilesCancel') }}
          </Button>
          <!-- Persistent live region (not v-if-inserted) so screen readers
               register it before the verdict text arrives, then announce the
               text change reliably. -->
          <span
            class="text-sm"
            :class="
              validationOk === null
                ? 'invisible'
                : validationOk
                  ? 'text-success'
                  : 'text-error'
            "
            role="status"
            aria-live="polite"
          >
            {{ validationMessage }}
          </span>
        </div>
      </div>
    </template>

    <!-- Subscription QR share dialog (remote profiles only). -->
    <Modal ref="shareModalRef" :title="t('profilesShareTitle')">
      <template #icon>
        <IconQrcode />
      </template>

      <div class="flex flex-col items-center gap-4">
        <p class="text-sm text-base-content/60">{{ shareName }}</p>

        <!-- qrSvg is built locally from the url (uqr), not remote HTML. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="w-56 max-w-full rounded-xl bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
          v-html="shareSvg"
        />

        <div class="flex w-full items-center gap-2">
          <input
            class="input-bordered input flex-1 font-mono text-xs input-sm"
            :value="shareUrl"
            readonly
            :aria-label="t('profilesShareUrl')"
          />
          <Button
            class="btn-sm"
            :icon="IconCopy"
            :aria-label="t('profilesShareCopy')"
            @click="onCopyShareUrl"
          >
            {{ t('profilesShareCopy') }}
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
