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
      <div class="flex flex-col">
        <ConfigTitle with-divider>
          {{ t('quickFilter') }}
        </ConfigTitle>
        <input
          v-model="configStore.quickFilterRegex"
          type="text"
          class="w-full rounded-lg border border-base-content/15 bg-base-200/80 px-3 py-2 text-sm text-base-content transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          placeholder="DIRECT|direct|dns-out"
        />
      </div>

      <div class="flex flex-col">
        <ConfigTitle with-divider>
          {{ t('tableSize') }}
        </ConfigTitle>
        <select
          v-model="configStore.connectionsTableSize"
          class="w-full cursor-pointer appearance-none rounded-lg border border-base-content/15 bg-base-200/80 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_0.5rem_center] bg-no-repeat px-3 py-2 pr-8 text-sm text-base-content transition-all duration-200 focus:border-primary focus:outline-none"
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

      <div class="flex flex-col">
        <ConfigTitle with-divider>
          {{ t('tagClientSourceIPWithName') }}
        </ConfigTitle>
        <div class="flex flex-col gap-4">
          <div
            class="flex overflow-hidden rounded-lg border border-base-content/15"
          >
            <select
              v-model="newTagSourceIP"
              class="cursor-pointer appearance-none rounded-none border-r border-none border-base-content/15 bg-base-200/80 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[right_0.5rem_center] bg-no-repeat px-3 py-2 pr-8 text-sm text-base-content transition-all duration-200 focus:border-primary focus:outline-none"
            >
              <option value="" />
              <option v-for="ip in untaggedSourceIPs" :key="ip" :value="ip">
                {{ ip || t('inner') }}
              </option>
            </select>
            <input
              v-model="newTagName"
              class="flex-1 rounded-none border-none bg-base-200/80 px-3 py-2 text-sm text-base-content transition-all duration-200 focus:outline-none"
              placeholder="name"
            />
            <Button class="rounded-none" @click="addTag">
              {{ t('tag') }}
            </Button>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="tag in configStore.clientSourceIPTags"
              :key="tag.tagName"
              class="flex items-center justify-between gap-2 rounded-lg bg-primary px-3 py-2 text-primary-content"
            >
              <span
                class="min-w-0 flex-1 overflow-hidden text-sm text-ellipsis whitespace-nowrap"
                >{{ tag.tagName }} ({{ tag.sourceIP }})</span
              >
              <button
                class="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-inherit opacity-70 transition-opacity duration-200 hover:opacity-100"
                @click="removeTag(tag.tagName)"
              >
                <IconX :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col">
        <ConfigTitle with-divider>
          {{ t('columns') }}
        </ConfigTitle>
        <div ref="columnListRef" class="flex flex-col gap-1">
          <div
            v-for="colId in columnOrder"
            :key="colId"
            class="flex items-center justify-between gap-2 rounded-lg bg-base-200/80 px-3 py-2 transition-colors duration-200 hover:bg-base-content/8"
          >
            <div class="flex items-center gap-3">
              <IconGripVertical
                class="drag-handle shrink-0 cursor-grab text-base-content/40 transition-colors duration-200 hover:text-base-content/70 active:cursor-grabbing"
                :size="16"
              />
              <span class="text-sm text-base-content">{{
                t(getColumnById(colId)?.key || colId)
              }}</span>
            </div>
            <label class="relative inline-block h-5 w-9 cursor-pointer">
              <input
                type="checkbox"
                class="peer h-0 w-0 opacity-0"
                :checked="configStore.connectionsTableColumnVisibility[colId]"
                @change="toggleColumnVisibility(colId)"
              />
              <span
                class="absolute inset-0 rounded-full bg-base-content/20 transition-all duration-200 peer-checked:bg-primary before:absolute before:top-1/2 before:left-0.5 before:h-3.5 before:w-3.5 before:-translate-y-1/2 before:rounded-full before:bg-base-100 before:shadow-sm before:transition-all before:duration-200 before:content-[''] peer-checked:before:left-[calc(100%-2px)] peer-checked:before:-translate-x-full"
              />
            </label>
          </div>
        </div>
      </div>

      <Button
        class="cursor-pointer rounded-lg border-none bg-neutral px-4 py-2 text-sm text-neutral-content transition-all duration-200 hover:opacity-90"
        @click="resetSettings"
      >
        {{ t('reset') }}
      </Button>
    </div>
  </Modal>
</template>
