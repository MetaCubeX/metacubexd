<script setup lang="ts">
import type { CONNECTIONS_TABLE_ACCESSOR_KEY } from '~/constants'
import type { ConnectionsTableColumnVisibility } from '~/types'
import { IconNetwork, IconX } from '@tabler/icons-vue'
import { CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY } from '~/constants'

defineProps<{
  allColumns: Array<{
    id: CONNECTIONS_TABLE_ACCESSOR_KEY
    key: string
  }>
  untaggedSourceIPs: string[]
}>()

const { t } = useI18n()
const configStore = useConfigStore()

const modalRef = ref<{ open: () => void; close: () => void }>()

// Tag form
const newTagSourceIP = ref('')
const newTagName = ref('')

function toggleColumnVisibility(colId: CONNECTIONS_TABLE_ACCESSOR_KEY) {
  configStore.connectionsTableColumnVisibility = {
    ...configStore.connectionsTableColumnVisibility,
    [colId]: !configStore.connectionsTableColumnVisibility[colId],
  } as ConnectionsTableColumnVisibility
}

function addTag() {
  if (newTagName.value && newTagSourceIP.value) {
    const exists = configStore.clientSourceIPTags.some(
      (tag) =>
        tag.tagName === newTagName.value ||
        tag.sourceIP === newTagSourceIP.value,
    )
    if (!exists) {
      configStore.clientSourceIPTags = [
        ...configStore.clientSourceIPTags,
        { tagName: newTagName.value, sourceIP: newTagSourceIP.value },
      ]
    }
    newTagName.value = ''
    newTagSourceIP.value = ''
  }
}

function removeTag(tagName: string) {
  configStore.clientSourceIPTags = configStore.clientSourceIPTags.filter(
    (tag) => tag.tagName !== tagName,
  )
}

function resetSettings() {
  configStore.connectionsTableColumnVisibility = {
    ...CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  }
}

defineExpose({
  open: () => modalRef.value?.open(),
  close: () => modalRef.value?.close(),
})
</script>

<template>
  <Modal ref="modalRef" :title="t('connectionsSettings')">
    <template #icon>
      <IconNetwork :size="24" />
    </template>

    <div class="flex flex-col gap-4">
      <div>
        <ConfigTitle with-divider>
          {{ t('quickFilter') }}
        </ConfigTitle>
        <input
          v-model="configStore.quickFilterRegex"
          type="text"
          class="input w-full"
          placeholder="DIRECT|direct|dns-out"
        />
      </div>

      <div>
        <ConfigTitle with-divider>
          {{ t('tableSize') }}
        </ConfigTitle>
        <select
          v-model="configStore.connectionsTableSize"
          class="select w-full"
        >
          <option value="xs">
            {{ t('xs') }}
          </option>
          <option value="sm">
            {{ t('sm') }}
          </option>
          <option value="md">
            {{ t('md') }}
          </option>
          <option value="lg">
            {{ t('lg') }}
          </option>
        </select>
      </div>

      <div>
        <ConfigTitle with-divider>
          {{ t('tagClientSourceIPWithName') }}
        </ConfigTitle>
        <div class="flex flex-col gap-4">
          <div class="join flex">
            <select v-model="newTagSourceIP" class="select join-item">
              <option value="" />
              <option v-for="ip in untaggedSourceIPs" :key="ip" :value="ip">
                {{ ip || t('inner') }}
              </option>
            </select>
            <input
              v-model="newTagName"
              class="input join-item flex-1"
              placeholder="name"
            />
            <Button class="join-item" @click="addTag">
              {{ t('tag') }}
            </Button>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="tag in configStore.clientSourceIPTags"
              :key="tag.tagName"
              class="badge w-full items-center justify-between gap-2 py-4 badge-primary"
            >
              <span class="truncate"
                >{{ tag.tagName }} ({{ tag.sourceIP }})</span
              >
              <Button
                class="btn-circle btn-ghost btn-xs"
                @click="removeTag(tag.tagName)"
              >
                <IconX :size="12" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <ConfigTitle with-divider>
          {{ t('columns') }}
        </ConfigTitle>
        <div class="flex flex-col">
          <div
            v-for="col in allColumns"
            :key="col.id"
            class="flex items-center justify-between py-2"
          >
            <span>{{ t(col.key) }}</span>
            <input
              type="checkbox"
              class="toggle"
              :checked="configStore.connectionsTableColumnVisibility[col.id]"
              @change="toggleColumnVisibility(col.id)"
            />
          </div>
        </div>
      </div>

      <Button class="btn-sm btn-neutral" @click="resetSettings">
        {{ t('reset') }}
      </Button>
    </div>
  </Modal>
</template>
