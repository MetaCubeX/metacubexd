<script setup lang="ts">
import {
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
  IconFile,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const serverStore = useServerStore()

// State
const selectedConfig = ref<string | null>(null)
const editingContent = ref('')
const isEditing = ref(false)
const newConfigName = ref('')
const isSaving = ref(false)
const hasChanges = ref(false)
const newConfigModalRef = ref<{ open: () => void; close: () => void } | null>(
  null,
)

// Load config list on mount
onMounted(async () => {
  await serverStore.fetchConfigList()
})

// Select and load a config file
async function selectConfig(name: string) {
  if (hasChanges.value) {
    const confirmed = confirm(t('configManager.unsavedChanges'))
    if (!confirmed) return
  }

  selectedConfig.value = name
  const content = await serverStore.readConfig(name)
  if (content !== null) {
    editingContent.value = content
    isEditing.value = true
    hasChanges.value = false
  }
}

// Save current config
async function saveConfig() {
  if (!selectedConfig.value) return

  isSaving.value = true
  const success = await serverStore.updateConfig(
    selectedConfig.value,
    editingContent.value,
  )
  isSaving.value = false

  if (success) {
    hasChanges.value = false
    toast.success(t('configManager.saveSuccess'))
  } else {
    toast.error(t('configManager.saveFailed'))
  }
}

// Create new config
async function createNewConfig() {
  if (!newConfigName.value.trim()) {
    toast.error(t('configManager.nameRequired'))
    return
  }

  const defaultContent = `# Mihomo Configuration
# Created: ${new Date().toISOString()}

mixed-port: 7890
allow-lan: false
mode: rule
log-level: info

dns:
  enable: true
  enhanced-mode: fake-ip
  nameserver:
    - 223.5.5.5
    - 119.29.29.29

proxies: []

proxy-groups: []

rules:
  - MATCH,DIRECT
`

  const success = await serverStore.createConfig(
    newConfigName.value,
    defaultContent,
  )
  if (success) {
    newConfigModalRef.value?.close()
    newConfigName.value = ''
    toast.success(t('configManager.createSuccess'))
    // Select the newly created config
    await selectConfig(
      serverStore.configList[serverStore.configList.length - 1] ||
        newConfigName.value,
    )
  } else {
    toast.error(t('configManager.createFailed'))
  }
}

// Delete config
async function deleteConfig(name: string) {
  const confirmed = confirm(t('configManager.confirmDelete', { name }))
  if (!confirmed) return

  const success = await serverStore.deleteConfig(name)
  if (success) {
    if (selectedConfig.value === name) {
      selectedConfig.value = null
      editingContent.value = ''
      isEditing.value = false
    }
    toast.success(t('configManager.deleteSuccess'))
  } else {
    toast.error(t('configManager.deleteFailed'))
  }
}

// Set as active config
async function setActive(name: string) {
  const success = await serverStore.setActiveConfig(name)
  if (success) {
    toast.success(t('configManager.setActiveSuccess'))
  } else {
    toast.error(t('configManager.setActiveFailed'))
  }
}

// Close editor
function closeEditor() {
  if (hasChanges.value) {
    const confirmed = confirm(t('configManager.unsavedChanges'))
    if (!confirmed) return
  }
  selectedConfig.value = null
  editingContent.value = ''
  isEditing.value = false
  hasChanges.value = false
}

// Handle editor changes
function onEditorChange(value: string) {
  editingContent.value = value
  hasChanges.value = true
}

// Refresh config list
async function refreshList() {
  await serverStore.fetchConfigList()
}
</script>

<template>
  <div class="flex h-full flex-col gap-4 lg:flex-row">
    <!-- Config File List -->
    <div class="w-full shrink-0 lg:w-64">
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body p-4">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="card-title text-sm">
              {{ t('configManager.configFiles') }}
            </h3>
            <div class="flex gap-1">
              <button
                class="btn btn-square btn-ghost btn-xs"
                :disabled="serverStore.isLoading"
                @click="refreshList"
              >
                <IconRefresh
                  class="h-4 w-4"
                  :class="{ 'animate-spin': serverStore.isLoading }"
                />
              </button>
              <button
                class="btn btn-square btn-ghost btn-xs"
                @click="newConfigModalRef?.open()"
              >
                <IconPlus class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            v-if="serverStore.configList.length === 0"
            class="py-4 text-center text-base-content/50"
          >
            {{ t('configManager.noConfigs') }}
          </div>

          <ul class="menu-compact menu gap-1">
            <li v-for="config in serverStore.configList" :key="config">
              <a
                class="flex items-center justify-between gap-2" :class="[
                  selectedConfig === config ? 'active' : '',
                ]"
                @click="selectConfig(config)"
              >
                <span class="flex items-center gap-2 truncate">
                  <IconFile class="h-4 w-4 shrink-0" />
                  <span class="truncate">{{ config }}</span>
                  <span
                    v-if="serverStore.activeConfig === config"
                    class="badge badge-xs badge-success"
                  >
                    {{ t('configManager.active') }}
                  </span>
                </span>
                <div class="flex gap-1" @click.stop>
                  <button
                    v-if="serverStore.activeConfig !== config"
                    class="btn btn-square btn-ghost btn-xs"
                    :title="t('configManager.setActive')"
                    @click="setActive(config)"
                  >
                    <IconCheck class="h-3 w-3" />
                  </button>
                  <button
                    class="btn btn-square text-error btn-ghost btn-xs"
                    :title="t('configManager.delete')"
                    @click="deleteConfig(config)"
                  >
                    <IconTrash class="h-3 w-3" />
                  </button>
                </div>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Editor Panel -->
    <div class="min-w-0 flex-1">
      <div
        v-if="isEditing && selectedConfig"
        class="card h-full bg-base-200 shadow-xl"
      >
        <div class="card-body flex flex-col p-4">
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <IconEdit class="h-5 w-5" />
              <h3 class="card-title text-sm">{{ selectedConfig }}</h3>
              <span v-if="hasChanges" class="badge badge-xs badge-warning">
                {{ t('configManager.modified') }}
              </span>
            </div>
            <div class="flex gap-2">
              <button
                class="btn btn-sm btn-primary"
                :disabled="!hasChanges || isSaving"
                @click="saveConfig"
              >
                <IconDeviceFloppy class="h-4 w-4" />
                {{ t('configManager.save') }}
              </button>
              <button class="btn btn-ghost btn-sm" @click="closeEditor">
                <IconX class="h-4 w-4" />
                {{ t('configManager.close') }}
              </button>
            </div>
          </div>

          <div
            class="min-h-[500px] flex-1 overflow-hidden rounded-lg border border-base-300"
          >
            <ClientOnly>
              <MonacoEditor
                :model-value="editingContent"
                language="yaml"
                @update:model-value="onEditorChange"
              />
            </ClientOnly>
          </div>
        </div>
      </div>

      <div v-else class="card h-full bg-base-200 shadow-xl">
        <div
          class="card-body flex items-center justify-center text-base-content/50"
        >
          <IconFile class="mb-2 h-12 w-12" />
          <p>{{ t('configManager.selectFile') }}</p>
        </div>
      </div>
    </div>

    <!-- New Config Modal -->
    <Modal ref="newConfigModalRef" :title="t('configManager.newConfig')">
      <div class="form-control">
        <label class="label">
          <span class="label-text">{{ t('configManager.fileName') }}</span>
        </label>
        <input
          v-model="newConfigName"
          type="text"
          class="input-bordered input"
          :placeholder="t('configManager.fileNamePlaceholder')"
          @keyup.enter="createNewConfig"
        />
      </div>
      <template #actions>
        <button class="btn btn-ghost" @click="newConfigModalRef?.close()">
          {{ t('configManager.cancel') }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="serverStore.isLoading"
          @click="createNewConfig"
        >
          {{ t('configManager.create') }}
        </button>
      </template>
    </Modal>
  </div>
</template>
