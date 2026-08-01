<script setup lang="ts">
import type { ConfigObject, ConfigValue } from '@metacubexd/config-editor'
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconExternalLink,
  IconPlus,
  IconRoute,
  IconTrash,
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import { useProxyConfigEditor } from '~/composables/useProxyConfigEditor'
import {
  BOOLEAN_ROUTING_FIELDS,
  isSensitiveRoutingField,
  NUMBER_ROUTING_FIELDS,
  PROXY_GROUP_TYPES,
  PROXY_TYPES,
  routingResourceFields,
} from '~/utils/routingResources'

type ResourceKind = 'proxy' | 'group'

const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()
const router = useRouter()
const editor = useProxyConfigEditor()
const editorModal = ref<{
  open: () => void
  close: (force?: boolean) => void
}>()
const resourceModal = ref<{
  open: () => void
  close: (force?: boolean) => void
}>()

const resourceKind = ref<ResourceKind>('proxy')
const resourceIndex = ref<number | null>(null)
const resourceDraft = ref<ConfigObject>({})
const resourceJson = ref('{}')
const resourceInitialJson = ref('{}')
const resourceInitialAdvancedJson = ref('{}')
const resourcePreservedFields = ref<ConfigObject>({})
const resourceError = ref('')
const nextMember = ref('')
const nextProvider = ref('')

const resourceFields = computed(() => [
  ...new Set([
    ...routingResourceFields(
      resourceKind.value,
      String(resourceDraft.value.type ?? ''),
    ),
    ...Object.keys(resourceDraft.value).filter(isSensitiveRoutingField),
  ]),
])
const editingExisting = computed(() => resourceIndex.value !== null)
const memberNames = computed(() =>
  editor.proxies.value
    .concat(editor.groups.value)
    .map((draft) => String(draft.value.name ?? ''))
    .filter(
      (name) =>
        name &&
        !getStringList(resourceDraft.value.proxies).includes(name) &&
        name !== String(resourceDraft.value.name ?? ''),
    ),
)
const availableProviderNames = computed(() =>
  editor.providerNames.value.filter(
    (name) => !getStringList(resourceDraft.value.use).includes(name),
  ),
)
const resourceDirty = computed(
  () =>
    JSON.stringify(resourceDraft.value) !== resourceInitialJson.value ||
    resourceJson.value !== resourceInitialAdvancedJson.value,
)

function clone<T extends ConfigValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getStringList(value: ConfigValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function setStringList(field: 'proxies' | 'use', values: string[]) {
  resourceDraft.value[field] = values
}

async function open() {
  editorModal.value?.open()
  await editor.load()
}

function confirmEditorClose() {
  return !editor.dirty.value || confirm(t('routingEditorDiscardConfirm'))
}

function confirmResourceClose() {
  return !resourceDirty.value || confirm(t('routingEditorDiscardConfirm'))
}

function openResource(kind: ResourceKind, index: number | null = null) {
  resourceKind.value = kind
  resourceIndex.value = index
  const current =
    index === null
      ? kind === 'proxy'
        ? { name: '', type: 'ss', server: '', port: 443 }
        : { name: '', type: 'select', proxies: [], use: [] }
      : (kind === 'proxy' ? editor.proxies.value : editor.groups.value)[index]
          ?.value
  resourceDraft.value = clone(current ?? {})
  const preserved: ConfigObject = {}
  const advanced: ConfigObject = {}
  const formFields = new Set([
    ...routingResourceFields(kind, String(resourceDraft.value.type ?? '')),
    'proxies',
    'use',
  ])
  for (const [field, value] of Object.entries(resourceDraft.value)) {
    if (isSensitiveRoutingField(field)) {
      preserved[field] = clone(value)
    } else if (!formFields.has(field)) {
      advanced[field] = clone(value)
    }
  }
  resourcePreservedFields.value = preserved
  resourceJson.value = JSON.stringify(advanced, null, 2)
  resourceInitialJson.value = JSON.stringify(resourceDraft.value)
  resourceInitialAdvancedJson.value = resourceJson.value
  resourceError.value = ''
  nextMember.value = ''
  nextProvider.value = ''
  resourceModal.value?.open()
}

function updateTextField(field: string, event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (field === 'type') {
    changeResourceType(value)
    return
  }
  resourceDraft.value[field] = value
}

function changeResourceType(nextType: string) {
  let advanced: ConfigObject
  try {
    const parsed = JSON.parse(resourceJson.value) as unknown
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error(t('routingEditorJsonObjectRequired'))
    }
    advanced = parsed as ConfigObject
  } catch (error) {
    resourceError.value = error instanceof Error ? error.message : String(error)
    return
  }

  const previousType = String(resourceDraft.value.type ?? '')
  const previousFields = routingResourceFields(resourceKind.value, previousType)
  const nextFields = new Set(
    routingResourceFields(resourceKind.value, nextType),
  )
  for (const field of previousFields) {
    if (
      !nextFields.has(field) &&
      !['name', 'type'].includes(field) &&
      !isSensitiveRoutingField(field) &&
      resourceDraft.value[field] !== undefined
    ) {
      advanced[field] = clone(resourceDraft.value[field])
    }
  }
  for (const field of nextFields) {
    if (advanced[field] === undefined) continue
    resourceDraft.value[field] = clone(advanced[field])
    delete advanced[field]
  }
  resourceDraft.value.type = nextType
  resourceJson.value = JSON.stringify(advanced, null, 2)
  resourceError.value = ''
}

function updateNumberField(field: string, event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (!value) delete resourceDraft.value[field]
  else resourceDraft.value[field] = Number(value)
}

function updateBooleanField(field: string, event: Event) {
  resourceDraft.value[field] = (event.target as HTMLInputElement).checked
}

function moveListItem(field: 'proxies' | 'use', from: number, to: number) {
  const values = getStringList(resourceDraft.value[field])
  if (to < 0 || to >= values.length) return
  const [item] = values.splice(from, 1)
  if (!item) return
  values.splice(to, 0, item)
  setStringList(field, values)
}

function removeListItem(field: 'proxies' | 'use', index: number) {
  setStringList(
    field,
    getStringList(resourceDraft.value[field]).filter(
      (_, itemIndex) => itemIndex !== index,
    ),
  )
}

function addMember() {
  if (!nextMember.value) return
  setStringList('proxies', [
    ...getStringList(resourceDraft.value.proxies),
    nextMember.value,
  ])
  nextMember.value = ''
}

function addProvider() {
  if (!nextProvider.value) return
  setStringList('use', [
    ...getStringList(resourceDraft.value.use),
    nextProvider.value,
  ])
  nextProvider.value = ''
}

function saveResource() {
  let advanced: unknown
  try {
    advanced = JSON.parse(resourceJson.value)
  } catch (error) {
    resourceError.value = error instanceof Error ? error.message : String(error)
    return
  }
  if (!advanced || Array.isArray(advanced) || typeof advanced !== 'object') {
    resourceError.value = t('routingEditorJsonObjectRequired')
    return
  }

  const value = {
    ...clone(resourcePreservedFields.value),
    ...clone(advanced as ConfigObject),
  }
  for (const field of resourceFields.value) {
    const fieldValue = resourceDraft.value[field]
    if (fieldValue === '' && !['name', 'type'].includes(field)) {
      delete value[field]
    } else if (fieldValue !== undefined) {
      value[field] = clone(fieldValue)
    }
  }
  if (resourceKind.value === 'group') {
    value.proxies = clone(getStringList(resourceDraft.value.proxies))
    value.use = clone(getStringList(resourceDraft.value.use))
  }

  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const type = typeof value.type === 'string' ? value.type.trim() : ''
  if (!name || !type) {
    resourceError.value = t('routingEditorNameTypeRequired')
    return
  }
  const current =
    resourceIndex.value === null
      ? undefined
      : { kind: resourceKind.value, index: resourceIndex.value }
  if (editor.nameExists(name, current)) {
    resourceError.value = t('routingEditorDuplicateName', { name })
    return
  }
  value.name = name
  value.type = type

  if (resourceIndex.value === null) editor.add(resourceKind.value, value)
  else editor.update(resourceKind.value, resourceIndex.value, value)
  resourceInitialJson.value = JSON.stringify(resourceDraft.value)
  resourceModal.value?.close(true)
}

function removeResource(kind: ResourceKind, index: number) {
  if (editor.remove(kind, index)) return
  if (!editor.blockedReferences.value.length) return
  toast.error(t('routingEditorDeleteBlocked'), {
    description: editor.blockedReferences.value
      .map((reference) => reference.path)
      .join('\n'),
  })
}

async function saveEditor() {
  const result = await editor.save()
  if (result === 'saved' || result === 'unchanged') {
    toast.success(t('proxyConfigSaved'))
    editorModal.value?.close(true)
    emit('saved')
    return
  }
  if (result === 'invalid') {
    toast.error(t('proxyConfigSaveFailed'), {
      description: editor.diagnostics.value
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => diagnostic.message)
        .join('\n'),
    })
    return
  }
  if (result === 'error') {
    toast.error(t('proxyConfigSaveFailed'), {
      description: editor.errorMessage.value,
    })
  }
}

async function openFullEditor() {
  editorModal.value?.close(true)
  await router.push(editor.fullEditorPath.value)
}

function goToProfiles() {
  editorModal.value?.close(true)
  void router.push('/profiles')
}

defineExpose({ open })
</script>

<template>
  <Modal
    ref="editorModal"
    size="xl"
    :title="t('proxyConfigEditorTitle')"
    :before-close="confirmEditorClose"
  >
    <template #icon>
      <IconRoute :size="24" />
    </template>

    <div
      v-if="editor.loading.value"
      class="flex min-h-64 items-center justify-center"
    >
      <span class="loading loading-lg loading-ring text-primary" />
    </div>

    <div
      v-else-if="editor.state.value === 'no-active-profile'"
      class="flex min-h-64 flex-col items-center justify-center gap-4 text-center"
    >
      <IconAlertTriangle :size="36" class="text-warning" />
      <p class="max-w-xl text-sm text-base-content/70">
        {{ t('routingEditorNoActiveProfile') }}
      </p>
      <Button class="btn-primary btn-sm" @click="goToProfiles">
        {{ t('profiles') }}
      </Button>
    </div>

    <div
      v-else-if="editor.state.value === 'conflict'"
      class="flex min-h-64 flex-col items-center justify-center gap-4 text-center"
    >
      <IconAlertTriangle :size="36" class="text-warning" />
      <div>
        <p class="font-semibold">{{ t('routingEditorConflict') }}</p>
        <p class="mt-1 max-w-xl text-sm text-base-content/70">
          {{ t('routingEditorConflictHint') }}
        </p>
      </div>
      <Button class="btn-primary btn-sm" @click="openFullEditor">
        <IconExternalLink :size="16" />
        {{ t('routingEditorResolveConflict') }}
      </Button>
    </div>

    <div
      v-else-if="editor.state.value !== 'ready'"
      class="flex min-h-64 flex-col items-center justify-center gap-3 text-center"
    >
      <IconAlertTriangle :size="36" class="text-error" />
      <p class="max-w-xl text-sm text-error">
        {{ editor.errorMessage.value || t('proxyConfigLoadFailed') }}
      </p>
    </div>

    <div v-else class="flex flex-col gap-5">
      <p class="text-sm text-base-content/65">
        {{ t('proxyConfigEditorHint') }}
      </p>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="min-w-0 rounded-xl border border-base-content/10 p-3">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 class="font-semibold">{{ t('routingEditorNodes') }}</h3>
            <Button class="btn-primary btn-sm" @click="openResource('proxy')">
              <IconPlus :size="16" />
              {{ t('add') }}
            </Button>
          </div>
          <div
            v-if="!editor.proxies.value.length"
            class="p-6 text-center text-sm opacity-55"
          >
            {{ t('noData') }}
          </div>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="(draft, index) in editor.proxies.value"
              :key="`${draft.originalName || draft.value.name}-${index}`"
              class="flex min-w-0 items-center gap-2 rounded-lg border border-base-content/8 bg-base-200/50 p-2"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ draft.value.name }}
                </p>
                <p class="truncate text-xs text-base-content/55">
                  {{ draft.value.type }}
                  <template v-if="draft.value.server">
                    · {{ draft.value.server }}:{{ draft.value.port }}</template
                  >
                </p>
              </div>
              <Button
                class="btn-ghost btn-xs"
                :disabled="index === 0"
                :title="t('moveUp')"
                @click="editor.move('proxy', index, index - 1)"
                ><IconChevronUp :size="16"
              /></Button>
              <Button
                class="btn-ghost btn-xs"
                :disabled="index === editor.proxies.value.length - 1"
                :title="t('moveDown')"
                @click="editor.move('proxy', index, index + 1)"
                ><IconChevronDown :size="16"
              /></Button>
              <Button
                class="btn-ghost btn-xs"
                :title="t('edit')"
                @click="openResource('proxy', index)"
              >
                <IconEdit :size="16" />
              </Button>
              <Button
                class="btn-ghost text-error btn-xs"
                :title="t('delete')"
                @click="removeResource('proxy', index)"
              >
                <IconTrash :size="16" />
              </Button>
            </div>
          </div>
        </section>

        <section class="min-w-0 rounded-xl border border-base-content/10 p-3">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 class="font-semibold">{{ t('proxyGroups') }}</h3>
            <Button class="btn-primary btn-sm" @click="openResource('group')">
              <IconPlus :size="16" />
              {{ t('add') }}
            </Button>
          </div>
          <div
            v-if="!editor.groups.value.length"
            class="p-6 text-center text-sm opacity-55"
          >
            {{ t('noData') }}
          </div>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="(draft, index) in editor.groups.value"
              :key="`${draft.originalName || draft.value.name}-${index}`"
              class="flex min-w-0 items-center gap-2 rounded-lg border border-base-content/8 bg-base-200/50 p-2"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ draft.value.name }}
                </p>
                <p class="truncate text-xs text-base-content/55">
                  {{ draft.value.type }} ·
                  {{ getStringList(draft.value.proxies).length }}
                  {{ t('routingEditorMembers') }} ·
                  {{ getStringList(draft.value.use).length }} Provider
                </p>
              </div>
              <Button
                class="btn-ghost btn-xs"
                :disabled="index === 0"
                :title="t('moveUp')"
                @click="editor.move('group', index, index - 1)"
              >
                <IconChevronUp :size="16" />
              </Button>
              <Button
                class="btn-ghost btn-xs"
                :disabled="index === editor.groups.value.length - 1"
                :title="t('moveDown')"
                @click="editor.move('group', index, index + 1)"
              >
                <IconChevronDown :size="16" />
              </Button>
              <Button
                class="btn-ghost btn-xs"
                :title="t('edit')"
                @click="openResource('group', index)"
              >
                <IconEdit :size="16" />
              </Button>
              <Button
                class="btn-ghost text-error btn-xs"
                :title="t('delete')"
                @click="removeResource('group', index)"
              >
                <IconTrash :size="16" />
              </Button>
            </div>
          </div>
        </section>
      </div>

      <div
        v-if="editor.blockedReferences.value.length"
        class="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"
      >
        <p class="font-semibold text-warning">
          {{ t('routingEditorDeleteBlocked') }}:
          {{ editor.blockedResourceName.value }}
        </p>
        <ul class="mt-2 list-inside list-disc font-mono text-xs break-all">
          <li
            v-for="reference in editor.blockedReferences.value"
            :key="`${reference.kind}:${reference.path}`"
          >
            {{ reference.path }}
          </li>
        </ul>
      </div>

      <div
        v-if="editor.diagnostics.value.length"
        class="rounded-xl border border-base-content/10 p-3"
      >
        <p class="mb-2 text-sm font-semibold">
          {{ t('visualEditorDiagnostics') }}
        </p>
        <ul class="flex flex-col gap-1 text-xs">
          <li
            v-for="diagnostic in editor.diagnostics.value"
            :key="`${diagnostic.code}:${diagnostic.path.join('.')}`"
            :class="
              diagnostic.severity === 'error' ? 'text-error' : 'text-warning'
            "
          >
            {{ diagnostic.path.join('.') || '$' }}: {{ diagnostic.message }}
          </li>
        </ul>
      </div>
    </div>

    <template #actions>
      <template v-if="editor.state.value === 'ready'">
        <Button class="btn-ghost btn-sm" @click="editorModal?.close()">{{
          t('cancel')
        }}</Button>
        <Button
          class="btn-primary btn-sm"
          :loading="editor.saving.value"
          :disabled="
            editor.diagnostics.value.some((item) => item.severity === 'error')
          "
          @click="saveEditor"
          >{{ t('profilesSave') }}</Button
        >
      </template>
    </template>
  </Modal>

  <Modal
    ref="resourceModal"
    :title="t('visualEditorResourceEdit')"
    :before-close="confirmResourceClose"
  >
    <div class="flex flex-col gap-4">
      <p v-if="editingExisting" class="text-xs text-base-content/60">
        {{ t('routingEditorNameLocked') }}
      </p>
      <template v-for="field in resourceFields" :key="field">
        <label class="form-control gap-1">
          <span class="text-sm font-medium">{{ field }}</span>
          <select
            v-if="field === 'type'"
            :value="resourceDraft[field]"
            class="select-bordered select select-sm"
            @change="updateTextField(field, $event)"
          >
            <option
              v-for="option in resourceKind === 'proxy'
                ? PROXY_TYPES
                : PROXY_GROUP_TYPES"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
          <input
            v-else-if="BOOLEAN_ROUTING_FIELDS.has(field)"
            :checked="resourceDraft[field] === true"
            type="checkbox"
            class="toggle toggle-primary toggle-sm"
            @change="updateBooleanField(field, $event)"
          />
          <input
            v-else-if="NUMBER_ROUTING_FIELDS.has(field)"
            :value="resourceDraft[field]"
            type="number"
            class="input-bordered input input-sm"
            @input="updateNumberField(field, $event)"
          />
          <input
            v-else
            :value="resourceDraft[field]"
            :disabled="field === 'name' && editingExisting"
            :type="isSensitiveRoutingField(field) ? 'password' : 'text'"
            class="input-bordered input input-sm"
            @input="updateTextField(field, $event)"
          />
        </label>
      </template>

      <template v-if="resourceKind === 'group'">
        <section class="rounded-xl border border-base-content/10 p-3">
          <h4 class="mb-2 text-sm font-semibold">
            {{ t('routingEditorMembers') }}
          </h4>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="(name, index) in getStringList(resourceDraft.proxies)"
              :key="`${name}-${index}`"
              class="flex items-center gap-2 rounded-lg bg-base-200/60 px-2 py-1.5"
            >
              <span class="min-w-0 flex-1 truncate text-sm">{{ name }}</span>
              <Button
                class="btn-ghost btn-xs"
                :disabled="index === 0"
                :title="t('moveUp')"
                @click="moveListItem('proxies', index, index - 1)"
                ><IconChevronUp :size="15"
              /></Button>
              <Button
                class="btn-ghost btn-xs"
                :disabled="
                  index === getStringList(resourceDraft.proxies).length - 1
                "
                :title="t('moveDown')"
                @click="moveListItem('proxies', index, index + 1)"
                ><IconChevronDown :size="15"
              /></Button>
              <Button
                class="btn-ghost text-error btn-xs"
                :title="t('delete')"
                @click="removeListItem('proxies', index)"
                ><IconTrash :size="15"
              /></Button>
            </div>
          </div>
          <div class="mt-2 flex gap-2">
            <select
              v-model="nextMember"
              class="select-bordered select min-w-0 flex-1 select-sm"
            >
              <option value="">{{ t('routingEditorSelectMember') }}</option>
              <option v-for="name in memberNames" :key="name" :value="name">
                {{ name }}
              </option>
            </select>
            <Button
              class="btn-ghost btn-sm"
              :disabled="!nextMember"
              @click="addMember"
              ><IconPlus :size="16"
            /></Button>
          </div>
        </section>

        <section class="rounded-xl border border-base-content/10 p-3">
          <h4 class="mb-2 text-sm font-semibold">Proxy Provider</h4>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="(name, index) in getStringList(resourceDraft.use)"
              :key="`${name}-${index}`"
              class="flex items-center gap-2 rounded-lg bg-base-200/60 px-2 py-1.5"
            >
              <span class="min-w-0 flex-1 truncate text-sm">{{ name }}</span>
              <Button
                class="btn-ghost btn-xs"
                :disabled="index === 0"
                :title="t('moveUp')"
                @click="moveListItem('use', index, index - 1)"
                ><IconChevronUp :size="15"
              /></Button>
              <Button
                class="btn-ghost btn-xs"
                :disabled="
                  index === getStringList(resourceDraft.use).length - 1
                "
                :title="t('moveDown')"
                @click="moveListItem('use', index, index + 1)"
                ><IconChevronDown :size="15"
              /></Button>
              <Button
                class="btn-ghost text-error btn-xs"
                :title="t('delete')"
                @click="removeListItem('use', index)"
                ><IconTrash :size="15"
              /></Button>
            </div>
          </div>
          <div class="mt-2 flex gap-2">
            <select
              v-model="nextProvider"
              class="select-bordered select min-w-0 flex-1 select-sm"
            >
              <option value="">{{ t('routingEditorSelectProvider') }}</option>
              <option
                v-for="name in availableProviderNames"
                :key="name"
                :value="name"
              >
                {{ name }}
              </option>
            </select>
            <Button
              class="btn-ghost btn-sm"
              :disabled="!nextProvider"
              @click="addProvider"
              ><IconPlus :size="16"
            /></Button>
          </div>
        </section>
      </template>

      <details class="rounded-xl border border-base-content/10 p-3">
        <summary class="cursor-pointer text-sm font-semibold">
          {{ t('visualEditorAdvancedJson') }}
        </summary>
        <textarea
          v-model="resourceJson"
          class="textarea-bordered textarea mt-3 min-h-56 w-full text-left font-mono text-xs"
          dir="ltr"
          spellcheck="false"
        />
      </details>
      <p v-if="resourceError" class="text-sm text-error">{{ resourceError }}</p>
    </div>

    <template #actions>
      <Button class="btn-ghost btn-sm" @click="resourceModal?.close()">{{
        t('cancel')
      }}</Button>
      <Button class="btn-primary btn-sm" @click="saveResource">{{
        t('profilesSave')
      }}</Button>
    </template>
  </Modal>
</template>
