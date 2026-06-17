<!-- packages/ui/pages/profiles.vue -->
<script setup lang="ts">
import type { ProfileMeta } from '~/types/control'
import {
  IconCopy,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconQrcode,
  IconTrash,
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'

const { t } = useI18n()
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
  loading,
  refresh,
  create,
  createMerge,
  createScript,
  duplicate,
  remove,
  save,
  saveMerge,
  saveScript,
  setEnabled,
  setScriptEnabled,
  load,
  validate,
  activate,
} = useProfiles()

const newName = ref('')
const newMergeName = ref('')
const newScriptName = ref('')

const editingId = ref<string | null>(null)
// Whether the open editor targets a merge overlay — drives save-vs-recompose.
const editingMerge = ref(false)
// Whether the open editor targets a script transform — drives the JS editor
// language and routes save through saveScript (which recomposes).
const editingScript = ref(false)
const editingText = ref('')
const validationMessage = ref('')
const validationOk = ref<boolean | null>(null)
const busy = ref(false)

onMounted(() => {
  if (hasFeature('profiles'))
    refresh().catch((err) =>
      console.error('[profiles] initial load failed', err),
    )
})

const openEditor = async (
  id: string,
  kind: 'base' | 'merge' | 'script' = 'base',
) => {
  busy.value = true
  try {
    const detail = await load(id)
    editingText.value = detail.content
    editingId.value = id
    editingMerge.value = kind === 'merge'
    editingScript.value = kind === 'script'
    validationMessage.value = ''
    validationOk.value = null
  } finally {
    busy.value = false
  }
}

const closeEditor = () => {
  editingId.value = null
  editingMerge.value = false
  editingScript.value = false
  editingText.value = ''
}

const onSave = async () => {
  if (!editingId.value) return
  busy.value = true
  try {
    // Editing a merge overlay or script transform re-composes the active base
    // after saving; a plain base profile just saves its content.
    if (editingScript.value) {
      await saveScript(editingId.value, editingText.value)
    } else if (editingMerge.value) {
      await saveMerge(editingId.value, editingText.value)
    } else {
      await save(editingId.value, editingText.value)
    }
  } finally {
    busy.value = false
  }
}

const onValidate = async () => {
  if (!editingId.value) return
  busy.value = true
  try {
    await save(editingId.value, editingText.value)
    const res = await validate(editingId.value)
    validationOk.value = res.valid
    validationMessage.value = res.valid
      ? t('profilesValidationOk')
      : res.message
  } finally {
    busy.value = false
  }
}

const onActivate = async (id: string) => {
  busy.value = true
  try {
    const state = await activate(id)
    kernelStore.state = state
  } finally {
    busy.value = false
  }
}

const onCreate = async () => {
  if (!newName.value.trim()) return
  busy.value = true
  try {
    await create({ name: newName.value.trim() })
    newName.value = ''
    // A new base profile changes the onboarding "do we have a subscription?"
    // signal consumed by the wizard gate + empty-state banners.
    await useProfileStatus().refresh()
  } finally {
    busy.value = false
  }
}

const onCreateMerge = async () => {
  if (!newMergeName.value.trim()) return
  busy.value = true
  try {
    await createMerge(newMergeName.value.trim())
    newMergeName.value = ''
  } finally {
    busy.value = false
  }
}

const onCreateScript = async () => {
  if (!newScriptName.value.trim()) return
  busy.value = true
  try {
    await createScript(newScriptName.value.trim())
    newScriptName.value = ''
  } finally {
    busy.value = false
  }
}

const onToggleMerge = async (id: string, event: Event) => {
  const next = (event.target as HTMLInputElement).checked
  busy.value = true
  try {
    await setEnabled(id, next)
  } finally {
    busy.value = false
  }
}

const onToggleScript = async (id: string, event: Event) => {
  const next = (event.target as HTMLInputElement).checked
  busy.value = true
  try {
    await setScriptEnabled(id, next)
  } finally {
    busy.value = false
  }
}

// The prominent import hero (ProfileImportHero) owns the actual import; it runs
// its own useProfiles + refreshes the shared profile-status singleton. Refresh
// THIS page's per-instance list too so the base-profile grid below updates.
const onHeroImported = async () => {
  await refresh()
}

const onDuplicate = async (p: ProfileMeta) => {
  busy.value = true
  try {
    await duplicate(p.id, `${p.name} copy`)
  } finally {
    busy.value = false
  }
}

const onRemove = async (id: string) => {
  busy.value = true
  try {
    await remove(id)
    if (editingId.value === id) closeEditor()
    // Deleting the LAST base profile must re-surface the onboarding banners/wizard.
    await useProfileStatus().refresh()
  } finally {
    busy.value = false
  }
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
      <div v-if="loading" class="loading mx-auto loading-spinner" />
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
          class="rounded-xl border border-base-content/10 bg-base-200 p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold">{{ p.name }}</span>
            <span class="badge badge-ghost badge-sm">{{ p.type }}</span>
          </div>

          <SubscriptionUsageCard :info="p.subscriptionInfo" />

          <div class="mt-3 flex flex-wrap gap-2">
            <Button class="btn-xs" :icon="IconPencil" @click="openEditor(p.id)">
              {{ t('profilesEdit') }}
            </Button>
            <Button
              class="btn-xs"
              :icon="IconCopy"
              :loading="busy"
              @click="onDuplicate(p)"
            >
              {{ t('profilesDuplicate') }}
            </Button>
            <Button
              class="btn-xs btn-success"
              :icon="IconPlayerPlay"
              :loading="busy"
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
              class="btn-xs btn-error"
              :icon="IconTrash"
              :loading="busy"
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
              class="btn-sm btn-primary"
              :icon="IconPlus"
              :loading="busy"
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
                  class="btn-sm btn-primary"
                  :icon="IconPlus"
                  :loading="busy"
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
                  <span class="font-semibold">{{ m.name }}</span>
                  <label class="flex items-center gap-2 text-sm">
                    <span class="text-base-content/60">{{
                      t('profilesMergeEnabled')
                    }}</span>
                    <input
                      type="checkbox"
                      class="toggle toggle-primary toggle-sm"
                      :checked="m.enabled !== false"
                      :disabled="busy"
                      :aria-label="t('profilesMergeEnabled')"
                      @change="onToggleMerge(m.id, $event)"
                    />
                  </label>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <Button
                    class="btn-xs"
                    :icon="IconPencil"
                    @click="openEditor(m.id, 'merge')"
                  >
                    {{ t('profilesEdit') }}
                  </Button>
                  <Button
                    class="btn-xs btn-error"
                    :icon="IconTrash"
                    :loading="busy"
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
                  class="btn-sm btn-primary"
                  :icon="IconPlus"
                  :loading="busy"
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
                      :disabled="busy"
                      :aria-label="t('profilesScriptEnabled')"
                      @change="onToggleScript(s.id, $event)"
                    />
                  </label>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <Button
                    class="btn-xs"
                    :icon="IconPencil"
                    @click="openEditor(s.id, 'script')"
                  >
                    {{ t('profilesEdit') }}
                  </Button>
                  <Button
                    class="btn-xs btn-error"
                    :icon="IconTrash"
                    :loading="busy"
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
        class="rounded-xl border border-base-content/10 bg-base-200 p-4"
      >
        <ClientOnly>
          <MonacoYamlEditor
            v-model="editingText"
            :language="editingScript ? 'javascript' : 'yaml'"
          />
        </ClientOnly>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button class="btn-sm btn-primary" :loading="busy" @click="onSave">
            {{ t('profilesSave') }}
          </Button>
          <Button
            v-if="!editingScript"
            class="btn-sm"
            :loading="busy"
            @click="onValidate"
          >
            {{ t('profilesValidate') }}
          </Button>
          <Button class="btn-ghost btn-sm" @click="closeEditor">
            {{ t('profilesCancel') }}
          </Button>
          <span
            v-if="validationOk !== null"
            class="text-sm"
            :class="validationOk ? 'text-success' : 'text-error'"
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
            class="input-bordered input input-sm flex-1 font-mono text-xs"
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
