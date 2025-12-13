<script setup lang="ts">
import type { CONNECTIONS_TABLE_ACCESSOR_KEY } from '~/constants'
import type { ConnectionsTableColumnVisibility } from '~/types'
import { IconGripVertical, IconNetwork, IconX } from '@tabler/icons-vue'
import { useSortable } from '@vueuse/integrations/useSortable'
import {
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
} from '~/constants'

const props = defineProps<{
  allColumns: Array<{
    id: CONNECTIONS_TABLE_ACCESSOR_KEY
    key: string
  }>
  untaggedSourceIPs: string[]
}>()

const { t } = useI18n()
const configStore = useConfigStore()

const modalRef = ref<{ open: () => void; close: () => void }>()
const columnListRef = ref<HTMLElement | null>(null)

// Tag form
const newTagSourceIP = ref('')
const newTagName = ref('')

// Column order for sortable - sync with store
const columnOrder = computed({
  get: () => {
    // Merge store order with all columns (in case new columns were added)
    const storeOrder = configStore.connectionsTableColumnOrder
    const allIds = props.allColumns.map((c) => c.id)
    const orderedIds = storeOrder.filter((id) => allIds.includes(id))
    const newIds = allIds.filter((id) => !storeOrder.includes(id))
    return [...orderedIds, ...newIds]
  },
  set: (val) => {
    configStore.connectionsTableColumnOrder = [...val]
  },
})

// Get column info by id
function getColumnById(id: CONNECTIONS_TABLE_ACCESSOR_KEY) {
  return props.allColumns.find((c) => c.id === id)
}

// Setup sortable
useSortable(columnListRef, columnOrder, {
  handle: '.drag-handle',
  animation: 150,
})

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
  configStore.connectionsTableColumnOrder = [
    ...CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  ]
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
        <div ref="columnListRef" class="flex flex-col gap-1">
          <div
            v-for="colId in columnOrder"
            :key="colId"
            class="flex items-center justify-between gap-2 rounded-lg bg-base-200 px-3 py-2 transition-colors hover:bg-base-300"
          >
            <div class="flex items-center gap-3">
              <IconGripVertical
                class="drag-handle shrink-0 cursor-grab text-base-content/40 transition-colors hover:text-base-content/70 active:cursor-grabbing"
                :size="16"
              />
              <span class="text-sm">{{
                t(getColumnById(colId)?.key || colId)
              }}</span>
            </div>
            <input
              type="checkbox"
              class="toggle toggle-primary toggle-sm"
              :checked="configStore.connectionsTableColumnVisibility[colId]"
              @change="toggleColumnVisibility(colId)"
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
