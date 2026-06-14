<!-- packages/ui/pages/profiles.vue -->
<script setup lang="ts">
import type { ProfileMeta } from '~/types/control'
import {
  IconCopy,
  IconDownload,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from '@tabler/icons-vue'

const { t } = useI18n()
const { hasFeature, ready } = useControlInfo()
const kernelStore = useKernelStore()

useHead({ title: computed(() => t('profiles')) })

// Lazy => monaco lands in its own async chunk, off the main bundle.
const MonacoYamlEditor = defineAsyncComponent(
  () => import('~/components/MonacoYamlEditor.client.vue'),
)

const {
  profiles,
  loading,
  refresh,
  create,
  duplicate,
  remove,
  importUrl,
  save,
  load,
  validate,
  activate,
} = useProfiles()

const newName = ref('')
const importUrlValue = ref('')
const importName = ref('')

const editingId = ref<string | null>(null)
const editingText = ref('')
const validationMessage = ref('')
const validationOk = ref<boolean | null>(null)
const busy = ref(false)

onMounted(() => {
  if (hasFeature('profiles')) refresh().catch(() => {})
})

const openEditor = async (id: string) => {
  busy.value = true
  try {
    const detail = await load(id)
    editingText.value = detail.content
    editingId.value = id
    validationMessage.value = ''
    validationOk.value = null
  } finally {
    busy.value = false
  }
}

const closeEditor = () => {
  editingId.value = null
  editingText.value = ''
}

const onSave = async () => {
  if (!editingId.value) return
  busy.value = true
  try {
    await save(editingId.value, editingText.value)
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
  } finally {
    busy.value = false
  }
}

const onImport = async () => {
  if (!importUrlValue.value.trim()) return
  busy.value = true
  try {
    await importUrl(
      importUrlValue.value.trim(),
      importName.value.trim() || undefined,
    )
    importUrlValue.value = ''
    importName.value = ''
  } finally {
    busy.value = false
  }
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
  } finally {
    busy.value = false
  }
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
      <!-- Create + import row -->
      <div class="flex flex-wrap gap-4">
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

        <div class="flex items-end gap-2">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-base-content/60">{{ t('profilesUrl') }}</span>
            <input
              v-model="importUrlValue"
              class="input-bordered input input-sm"
              placeholder="https://..."
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-base-content/60">{{ t('profilesName') }}</span>
            <input v-model="importName" class="input-bordered input input-sm" />
          </label>
          <Button
            class="btn-sm btn-secondary"
            :icon="IconDownload"
            :loading="busy"
            @click="onImport"
          >
            {{ t('profilesImport') }}
          </Button>
        </div>
      </div>

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
          v-for="p in profiles"
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

      <!-- Editor -->
      <div
        v-if="editingId"
        class="rounded-xl border border-base-content/10 bg-base-200 p-4"
      >
        <ClientOnly>
          <MonacoYamlEditor v-model="editingText" />
        </ClientOnly>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button class="btn-sm btn-primary" :loading="busy" @click="onSave">
            {{ t('profilesSave') }}
          </Button>
          <Button class="btn-sm" :loading="busy" @click="onValidate">
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
  </div>
</template>
