<script setup lang="ts">
import type {
  ConfigDocument,
  ConfigObject,
  ConfigPatchConflict,
  ConfigPatchOperation,
} from '@metacubexd/config-editor'
import type {
  ProfileEditorPreview,
  ProfileEditorSnapshot,
} from '~/types/control'
import {
  applyPatch,
  diffDocument,
  hashConfigValue,
  openDocument,
  replaceDocumentData,
} from '@metacubexd/config-editor'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBraces,
  IconChevronDown,
  IconChevronUp,
  IconCloud,
  IconCode,
  IconDeviceFloppy,
  IconEye,
  IconGripVertical,
  IconPlus,
  IconRoute,
  IconSettings,
  IconTrash,
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import {
  configGeneralKeys,
  configSectionSchema,
  defaultForSchema,
} from '~/utils/configSchema'
import { controlErrorMessage } from '~/utils/controlError'

type ResourceKind = 'proxy' | 'provider' | 'group' | 'rule-provider'
type LooseObject = Record<string, any>

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { ready, hasFeature } = useControlInfo()
const api = useControlApi()
const kernelStore = useKernelStore()
const profileId = computed(() => String(route.params.id ?? ''))

useHead({ title: computed(() => `${t('visualEditor')} · MetaCubeXD`) })

const MonacoYamlEditor = defineAsyncComponent(
  () => import('~/components/MonacoYamlEditor.client.vue'),
)

const snapshot = ref<ProfileEditorSnapshot | null>(null)
const preview = ref<ProfileEditorPreview | null>(null)
const loading = ref(true)
const applying = ref(false)
const resetting = ref(false)
const previewing = ref(false)
const loadError = ref('')
const mode = ref<'visual' | 'yaml'>('visual')
const originalYaml = ref('')
const yamlText = ref('')
const documentState = shallowRef<ConfigDocument | null>(null)
const configData = ref<LooseObject>({})
const yamlError = ref('')
const resolutionDirty = ref(false)

const sectionModal = ref<{ open: () => void; close: () => void }>()
const resourceModal = ref<{ open: () => void; close: () => void }>()
const previewModal = ref<{ open: () => void; close: () => void }>()
const editingSection = ref('')
const sectionDraft = ref<unknown>({})
const resourceKind = ref<ResourceKind>('proxy')
const resourceIndex = ref<number | null>(null)
const resourceOriginalName = ref('')
const resourceName = ref('')
const resourceDraft = ref<LooseObject>({})
const resourceJson = ref('{}')
const resourceError = ref('')
const draggedResource = ref<{
  kind: 'proxy' | 'provider'
  name: string
} | null>(null)

const SETTINGS_SECTIONS = [
  'general',
  'experimental',
  'profile',
  'iptables',
  'tls',
  'listeners',
  'hosts',
  'ntp',
  'dns',
  'tun',
  'tuic-server',
  'authentication',
  'tunnels',
  'sniffer',
  'clash-for-android',
]
const PROXY_TYPES = [
  'ss',
  'ssr',
  'http',
  'socks5',
  'vmess',
  'vless',
  'trojan',
  'hysteria2',
  'tuic',
  'wireguard',
  'ssh',
  'snell',
  'anytls',
  'direct',
  'reject',
  'pass',
]
const GROUP_TYPES = [
  'select',
  'url-test',
  'fallback',
  'load-balance',
  'relay',
  'smart',
]
const PROTOCOL_FIELDS: Record<string, string[]> = {
  ss: ['cipher', 'password', 'udp', 'udp-over-tcp'],
  ssr: ['cipher', 'password', 'obfs', 'protocol'],
  http: ['username', 'password', 'tls', 'skip-cert-verify'],
  socks5: ['username', 'password', 'tls', 'udp'],
  vmess: ['uuid', 'alterId', 'cipher', 'tls', 'network', 'servername'],
  vless: ['uuid', 'flow', 'tls', 'network', 'servername'],
  trojan: ['password', 'tls', 'sni', 'skip-cert-verify'],
  hysteria2: ['password', 'sni', 'skip-cert-verify', 'up', 'down'],
  tuic: ['uuid', 'password', 'sni', 'skip-cert-verify'],
  wireguard: ['private-key', 'public-key', 'ip', 'mtu'],
  ssh: ['username', 'password', 'private-key', 'host-key-algorithms'],
  snell: ['psk', 'version', 'obfs-opts'],
  anytls: ['password', 'client-fingerprint', 'sni', 'skip-cert-verify'],
}

const dirty = computed(
  () =>
    yamlText.value !== originalYaml.value ||
    resolutionDirty.value ||
    Boolean(snapshot.value?.conflicts.length),
)
const proxies = computed<LooseObject[]>(() =>
  Array.isArray(configData.value.proxies) ? configData.value.proxies : [],
)
const providers = computed(
  () =>
    Object.entries(
      typeof configData.value['proxy-providers'] === 'object' &&
        configData.value['proxy-providers']
        ? configData.value['proxy-providers']
        : {},
    ) as Array<[string, LooseObject]>,
)
const groups = computed<LooseObject[]>(() =>
  Array.isArray(configData.value['proxy-groups'])
    ? configData.value['proxy-groups']
    : [],
)
const rules = computed<string[]>(() =>
  Array.isArray(configData.value.rules) ? configData.value.rules : [],
)
const ruleProviders = computed(
  () =>
    Object.entries(
      typeof configData.value['rule-providers'] === 'object' &&
        configData.value['rule-providers']
        ? configData.value['rule-providers']
        : {},
    ) as Array<[string, LooseObject]>,
)
const diagnostics = computed(() => documentState.value?.diagnostics ?? [])
const hasDocumentErrors = computed(() =>
  diagnostics.value.some((diagnostic) => diagnostic.severity === 'error'),
)
const activeApplyLabel = computed(() =>
  snapshot.value?.active ? t('visualEditorApply') : t('visualEditorActivate'),
)
const sectionSchema = computed(() => configSectionSchema(editingSection.value))
const commonResourceFields = computed(() => {
  if (resourceKind.value === 'group') return ['name', 'type', 'url', 'interval']
  if (
    resourceKind.value === 'provider' ||
    resourceKind.value === 'rule-provider'
  )
    return ['type', 'url', 'path', 'interval', 'filter', 'exclude-filter']
  return [
    'name',
    'type',
    'server',
    'port',
    ...(PROTOCOL_FIELDS[String(resourceDraft.value.type)] ?? []),
  ]
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function loadEditor() {
  if (!profileId.value) return
  loading.value = true
  loadError.value = ''
  try {
    const next = await api.getProfileEditor(profileId.value)
    snapshot.value = next
    originalYaml.value = next.editableYaml
    yamlText.value = next.editableYaml
    const doc = openDocument(next.editableYaml)
    documentState.value = doc
    configData.value = clone(doc.data)
    yamlError.value = ''
    resolutionDirty.value = false
  } catch (error) {
    loadError.value = controlErrorMessage(error)
  } finally {
    loading.value = false
  }
}

watch(
  ready,
  (isReady) => {
    if (!isReady) return
    if (!hasFeature('visual-config-editor')) {
      loading.value = false
      loadError.value = t('visualEditorUnavailable')
      return
    }
    void loadEditor()
  },
  { immediate: true },
)

watch(yamlText, (source) => {
  if (mode.value !== 'yaml') return
  try {
    openDocument(source)
    yamlError.value = ''
  } catch (error) {
    yamlError.value = error instanceof Error ? error.message : String(error)
  }
})

function syncDocumentData(next: LooseObject) {
  if (!documentState.value) return
  const doc = replaceDocumentData(documentState.value, next as ConfigObject)
  documentState.value = doc
  configData.value = clone(doc.data)
  yamlText.value = doc.yaml
  yamlError.value = ''
}

function switchMode(next: 'visual' | 'yaml') {
  if (next === 'visual') {
    try {
      const doc = openDocument(yamlText.value)
      documentState.value = doc
      configData.value = clone(doc.data)
      yamlError.value = ''
    } catch (error) {
      yamlError.value = error instanceof Error ? error.message : String(error)
      return
    }
  }
  mode.value = next
}

function openSection(section: string) {
  editingSection.value = section
  if (section === 'general') {
    const generalKeys = new Set(configGeneralKeys())
    sectionDraft.value = Object.fromEntries(
      Object.entries(configData.value).filter(([key]) => generalKeys.has(key)),
    )
  } else {
    sectionDraft.value = clone(
      configData.value[section] ??
        defaultForSchema(configSectionSchema(section)),
    )
  }
  sectionModal.value?.open()
}

function saveSection() {
  const next = clone(configData.value)
  if (editingSection.value === 'general') {
    for (const key of configGeneralKeys()) delete next[key]
    Object.assign(next, sectionDraft.value)
  } else {
    next[editingSection.value] = clone(sectionDraft.value)
  }
  syncDocumentData(next)
  sectionModal.value?.close()
}

function sectionCount(section: string): number {
  if (section === 'general') {
    const keys = new Set(configGeneralKeys())
    return Object.keys(configData.value).filter((key) => keys.has(key)).length
  }
  const value = configData.value[section]
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object' && value !== null)
    return Object.keys(value).length
  return value === undefined ? 0 : 1
}

function openResource(
  kind: ResourceKind,
  value: LooseObject,
  index: number | null,
  name = '',
) {
  resourceKind.value = kind
  resourceIndex.value = index
  resourceOriginalName.value = name
  resourceName.value = name
  resourceDraft.value = clone(value)
  resourceJson.value = JSON.stringify(value, null, 2)
  resourceError.value = ''
  resourceModal.value?.open()
}

function addResource(kind: ResourceKind) {
  const defaults: Record<ResourceKind, LooseObject> = {
    proxy: { name: '', type: 'ss', server: '', port: 443 },
    provider: { type: 'http', url: '', interval: 3600 },
    group: { name: '', type: 'select', proxies: [] },
    'rule-provider': {
      type: 'http',
      behavior: 'domain',
      format: 'yaml',
      url: '',
    },
  }
  openResource(kind, defaults[kind], null)
}

function saveResource() {
  let advanced: LooseObject
  try {
    advanced = JSON.parse(resourceJson.value) as LooseObject
  } catch (error) {
    resourceError.value = error instanceof Error ? error.message : String(error)
    return
  }
  const value = { ...advanced }
  for (const field of commonResourceFields.value) {
    const fieldValue = resourceDraft.value[field]
    if (fieldValue === '' && !['name', 'type'].includes(field))
      delete value[field]
    else if (fieldValue !== undefined) value[field] = clone(fieldValue)
  }
  if (resourceKind.value === 'group') {
    value.proxies = clone(resourceDraft.value.proxies ?? [])
    value.use = clone(resourceDraft.value.use ?? [])
  }
  const next = clone(configData.value)
  if (resourceKind.value === 'proxy' || resourceKind.value === 'group') {
    const section = resourceKind.value === 'proxy' ? 'proxies' : 'proxy-groups'
    const items = Array.isArray(next[section]) ? [...next[section]] : []
    if (resourceIndex.value === null) items.push(value)
    else items[resourceIndex.value] = value
    next[section] = items
  } else {
    const section =
      resourceKind.value === 'provider' ? 'proxy-providers' : 'rule-providers'
    const items = { ...(next[section] ?? {}) }
    if (
      resourceOriginalName.value &&
      resourceOriginalName.value !== resourceName.value
    )
      delete items[resourceOriginalName.value]
    if (!resourceName.value.trim()) {
      resourceError.value = t('profilesName')
      return
    }
    items[resourceName.value.trim()] = value
    next[section] = items
  }
  syncDocumentData(next)
  resourceModal.value?.close()
}

function removeResource(kind: ResourceKind, indexOrName: number | string) {
  const next = clone(configData.value)
  if (kind === 'proxy' || kind === 'group') {
    const section = kind === 'proxy' ? 'proxies' : 'proxy-groups'
    const items = [...(next[section] ?? [])]
    items.splice(Number(indexOrName), 1)
    next[section] = items
  } else {
    const section = kind === 'provider' ? 'proxy-providers' : 'rule-providers'
    const items = { ...(next[section] ?? {}) }
    delete items[String(indexOrName)]
    next[section] = items
  }
  syncDocumentData(next)
}

function updateRule(index: number, value: string) {
  const next = clone(configData.value)
  const items = [...rules.value]
  items[index] = value
  next.rules = items
  syncDocumentData(next)
}

function addRule() {
  const next = clone(configData.value)
  next.rules = [...rules.value, 'MATCH,DIRECT']
  syncDocumentData(next)
}

function removeRule(index: number) {
  const next = clone(configData.value)
  next.rules = rules.value.filter((_, itemIndex) => itemIndex !== index)
  syncDocumentData(next)
}

function moveRule(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= rules.value.length) return
  const items = [...rules.value]
  const [item] = items.splice(index, 1)
  if (item === undefined) return
  items.splice(target, 0, item)
  const next = clone(configData.value)
  next.rules = items
  syncDocumentData(next)
}

function startDrag(kind: 'proxy' | 'provider', name: string) {
  draggedResource.value = { kind, name }
}

function dropOnGroup(index: number) {
  const dragged = draggedResource.value
  draggedResource.value = null
  if (!dragged) return
  const next = clone(configData.value)
  const items = [...groups.value]
  const group = { ...items[index] }
  const field = dragged.kind === 'proxy' ? 'proxies' : 'use'
  const values = Array.isArray(group[field]) ? [...group[field]] : []
  if (!values.includes(dragged.name)) values.push(dragged.name)
  group[field] = values
  items[index] = group
  next['proxy-groups'] = items
  syncDocumentData(next)
}

function addGroupBinding(
  index: number,
  field: 'proxies' | 'use',
  name: string,
) {
  if (!name) return
  const next = clone(configData.value)
  const items = [...groups.value]
  const group = { ...items[index] }
  const values = Array.isArray(group[field]) ? [...group[field]] : []
  if (!values.includes(name)) values.push(name)
  group[field] = values
  items[index] = group
  next['proxy-groups'] = items
  syncDocumentData(next)
}

function selectGroupBinding(
  index: number,
  field: 'proxies' | 'use',
  event: Event,
) {
  const select = event.target as HTMLSelectElement
  addGroupBinding(index, field, select.value)
  select.value = ''
}

function removeGroupBinding(
  index: number,
  field: 'proxies' | 'use',
  name: string,
) {
  const next = clone(configData.value)
  const items = [...groups.value]
  items[index] = {
    ...items[index],
    [field]: (items[index]?.[field] ?? []).filter(
      (value: string) => value !== name,
    ),
  }
  next['proxy-groups'] = items
  syncDocumentData(next)
}

function moveGroupBinding(
  index: number,
  field: 'proxies' | 'use',
  bindingIndex: number,
  delta: number,
) {
  const next = clone(configData.value)
  const items = [...groups.value]
  const values = [...(items[index]?.[field] ?? [])]
  const target = bindingIndex + delta
  if (target < 0 || target >= values.length) return
  const [value] = values.splice(bindingIndex, 1)
  if (value === undefined) return
  values.splice(target, 0, value)
  items[index] = { ...items[index], [field]: values }
  next['proxy-groups'] = items
  syncDocumentData(next)
}

function currentPatch() {
  const parsed = openDocument(yamlText.value)
  documentState.value = parsed
  return diffDocument(originalYaml.value, parsed)
}

async function showPreview() {
  previewing.value = true
  try {
    preview.value = await api.previewProfileEditor(
      profileId.value,
      currentPatch(),
    )
    previewModal.value?.open()
  } catch (error) {
    toast.error(t('visualEditorPreviewFailed'), {
      description: controlErrorMessage(error),
    })
  } finally {
    previewing.value = false
  }
}

async function applyChanges() {
  applying.value = true
  try {
    await api.applyProfileEditor(profileId.value, currentPatch())
    await kernelStore.fetchStatus().catch(() => {})
    toast.success(t('visualEditorApplied'))
    await loadEditor()
  } catch (error) {
    toast.error(t('visualEditorApplyFailed'), {
      description: controlErrorMessage(error),
    })
  } finally {
    applying.value = false
  }
}

async function resetOverlay() {
  if (!confirm(t('visualEditorResetConfirm'))) return
  resetting.value = true
  try {
    await api.resetProfileEditorOverlay(profileId.value)
    await kernelStore.fetchStatus().catch(() => {})
    toast.success(t('visualEditorReset'))
    await loadEditor()
  } catch (error) {
    toast.error(t('visualEditorApplyFailed'), {
      description: controlErrorMessage(error),
    })
  } finally {
    resetting.value = false
  }
}

function clearConflict(index: number) {
  if (!snapshot.value) return
  const conflicts = snapshot.value.conflicts.slice()
  conflicts.splice(index, 1)
  snapshot.value.conflicts = conflicts
  resolutionDirty.value = true
}

function keepLocal(conflict: ConfigPatchConflict, index: number) {
  if (!documentState.value) return
  const operation: ConfigPatchOperation = {
    ...conflict.operation,
    expectedHash: hashConfigValue(conflict.current),
  }
  const result = applyPatch(documentState.value, {
    version: 1,
    baseRevision: documentState.value.revision,
    operations: [operation],
  })
  if (result.conflicts.length) return
  documentState.value = result.document
  configData.value = clone(result.document.data)
  yamlText.value = result.document.yaml
  clearConflict(index)
}

function acceptUpstream(index: number) {
  clearConflict(index)
}

onBeforeRouteLeave(() => !dirty.value || confirm(t('visualEditorLeaveConfirm')))
if (import.meta.client) {
  useEventListener(window, 'beforeunload', (event) => {
    if (!dirty.value) return
    event.preventDefault()
  })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
    <div v-if="loading" class="flex min-h-64 items-center justify-center">
      <span class="loading loading-lg loading-ring text-primary" />
    </div>

    <div
      v-else-if="loadError"
      class="m-auto max-w-lg rounded-2xl bg-error/10 p-6 text-center text-error"
    >
      <IconAlertTriangle class="mx-auto mb-3" :size="36" />
      <p>{{ loadError }}</p>
      <Button class="mt-4 btn-ghost btn-sm" @click="router.push('/profiles')">
        {{ t('visualEditorBack') }}
      </Button>
    </div>

    <template v-else-if="snapshot">
      <header
        class="sticky top-0 z-20 rounded-2xl border border-base-content/10 bg-base-100/90 p-3 backdrop-blur-md"
      >
        <div class="flex flex-wrap items-center gap-3">
          <Button
            class="btn-ghost btn-sm"
            :icon="IconArrowLeft"
            @click="router.push('/profiles')"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="truncate text-lg font-bold">
                {{ snapshot.profile.name }}
              </h1>
              <span class="badge badge-sm">{{ snapshot.profile.type }}</span>
              <span
                v-if="snapshot.active"
                class="badge badge-sm badge-success"
                >{{ t('profilesActive') }}</span
              >
              <span v-if="dirty" class="badge badge-sm badge-warning">{{
                t('visualEditorUnsaved')
              }}</span>
            </div>
            <p class="text-xs text-base-content/55">
              {{ snapshot.schemaVersion }}
            </p>
          </div>

          <div class="join">
            <button
              class="btn join-item btn-sm"
              :class="mode === 'visual' && 'btn-active'"
              @click="switchMode('visual')"
            >
              <IconBraces :size="16" /> {{ t('visualEditorVisual') }}
            </button>
            <button
              class="btn join-item btn-sm"
              :class="mode === 'yaml' && 'btn-active'"
              @click="switchMode('yaml')"
            >
              <IconCode :size="16" /> YAML
            </button>
          </div>
          <Button
            v-if="snapshot.profile.type === 'remote'"
            class="btn-sm btn-warning"
            :icon="IconTrash"
            :loading="resetting"
            @click="resetOverlay"
          >
            {{ t('visualEditorReset') }}
          </Button>
          <Button
            class="btn-sm"
            :icon="IconEye"
            :loading="previewing"
            :disabled="Boolean(yamlError)"
            @click="showPreview"
          >
            {{ t('visualEditorPreview') }}
          </Button>
          <Button
            class="btn-primary btn-sm"
            :icon="IconDeviceFloppy"
            :loading="applying"
            :disabled="!dirty || Boolean(yamlError) || hasDocumentErrors"
            @click="applyChanges"
          >
            {{ activeApplyLabel }}
          </Button>
        </div>
      </header>

      <div
        v-if="snapshot.conflicts.length"
        class="rounded-2xl border border-warning/40 bg-warning/10 p-4"
      >
        <div class="mb-3 flex items-center gap-2 font-semibold text-warning">
          <IconAlertTriangle :size="18" /> {{ t('visualEditorConflicts') }}
        </div>
        <div
          v-for="(conflict, index) in snapshot.conflicts"
          :key="index"
          class="mb-2 rounded-xl bg-base-100/70 p-3 last:mb-0"
        >
          <code class="text-xs">{{ conflict.path.join('.') || '/' }}</code>
          <p class="text-sm text-base-content/60">{{ conflict.reason }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Button
              class="btn-warning btn-xs"
              @click="keepLocal(conflict as any, index)"
              >{{ t('visualEditorKeepLocal') }}</Button
            >
            <Button class="btn-ghost btn-xs" @click="acceptUpstream(index)">{{
              t('visualEditorAcceptUpstream')
            }}</Button>
            <Button class="btn-ghost btn-xs" @click="switchMode('yaml')">{{
              t('visualEditorManualMerge')
            }}</Button>
          </div>
        </div>
      </div>

      <div
        v-if="yamlError"
        class="rounded-xl bg-error/10 p-3 text-sm text-error"
      >
        {{ yamlError }}
      </div>

      <ClientOnly v-if="mode === 'yaml'">
        <MonacoYamlEditor v-model="yamlText" />
      </ClientOnly>

      <div v-else class="grid items-start gap-4 xl:grid-cols-3">
        <section
          class="rounded-2xl border border-base-content/10 bg-base-200 p-4"
        >
          <div
            class="mb-3 flex items-center gap-2 text-lg font-bold text-primary"
          >
            <IconSettings :size="20" /> {{ t('visualEditorSettings') }}
          </div>
          <div class="flex flex-col gap-2">
            <button
              v-for="section in SETTINGS_SECTIONS"
              :key="section"
              class="flex items-center justify-between rounded-xl bg-base-100 px-3 py-2 text-start hover:bg-base-300 focus-visible:outline-2 focus-visible:outline-primary"
              @click="openSection(section)"
            >
              <span class="font-medium">{{ section }}</span>
              <span class="badge badge-ghost badge-sm">{{
                sectionCount(section)
              }}</span>
            </button>
          </div>
        </section>

        <section
          class="rounded-2xl border border-base-content/10 bg-base-200 p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-lg font-bold text-primary">
              <IconCloud :size="20" /> {{ t('visualEditorResources') }}
            </div>
            <div class="flex gap-1">
              <Button
                class="btn-ghost btn-xs"
                :icon="IconPlus"
                @click="addResource('proxy')"
                >{{ t('visualEditorProxy') }}</Button
              >
              <Button
                class="btn-ghost btn-xs"
                :icon="IconPlus"
                @click="addResource('provider')"
                >{{ t('proxyProviders') }}</Button
              >
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <article
              v-for="(proxy, index) in proxies"
              :key="proxy.name || index"
              draggable="true"
              class="group rounded-xl bg-base-100 p-3"
              @dragstart="startDrag('proxy', String(proxy.name))"
            >
              <div class="flex items-center gap-2">
                <IconGripVertical :size="16" class="cursor-grab opacity-40" />
                <span class="badge badge-ghost badge-sm">{{ proxy.type }}</span>
                <button
                  class="min-w-0 flex-1 truncate text-start font-medium"
                  @click="openResource('proxy', proxy, index)"
                >
                  {{ proxy.name || t('visualEditorUnnamed') }}
                </button>
                <button
                  class="text-error opacity-60 hover:opacity-100"
                  @click="removeResource('proxy', index)"
                >
                  <IconTrash :size="16" />
                </button>
              </div>
              <p
                v-if="proxy.server"
                class="ms-6 mt-1 truncate text-xs text-base-content/50"
              >
                {{ proxy.server
                }}<span v-if="proxy.port">:{{ proxy.port }}</span>
              </p>
            </article>
            <article
              v-for="[name, provider] in providers"
              :key="name"
              draggable="true"
              class="rounded-xl bg-base-100 p-3"
              @dragstart="startDrag('provider', name)"
            >
              <div class="flex items-center gap-2">
                <IconGripVertical :size="16" class="cursor-grab opacity-40" />
                <span class="badge badge-ghost badge-sm">Provider</span>
                <button
                  class="min-w-0 flex-1 truncate text-start font-medium"
                  @click="openResource('provider', provider, null, name)"
                >
                  {{ name }}
                </button>
                <button
                  class="text-error opacity-60 hover:opacity-100"
                  @click="removeResource('provider', name)"
                >
                  <IconTrash :size="16" />
                </button>
              </div>
            </article>
          </div>
        </section>

        <section
          class="rounded-2xl border border-base-content/10 bg-base-200 p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-lg font-bold text-primary">
              <IconRoute :size="20" /> {{ t('visualEditorRouting') }}
            </div>
            <Button
              class="btn-ghost btn-xs"
              :icon="IconPlus"
              @click="addResource('group')"
              >{{ t('visualEditorGroup') }}</Button
            >
          </div>
          <div class="flex flex-col gap-3">
            <article
              v-for="(group, index) in groups"
              :key="group.name || index"
              class="rounded-xl border border-dashed border-base-content/15 bg-base-100 p-3"
              @dragover.prevent
              @drop.prevent="dropOnGroup(index)"
            >
              <div class="flex items-center gap-2">
                <span class="badge badge-ghost badge-sm">{{ group.type }}</span>
                <button
                  class="min-w-0 flex-1 truncate text-start font-semibold"
                  @click="openResource('group', group, index)"
                >
                  {{ group.name || t('visualEditorUnnamed') }}
                </button>
                <button
                  class="text-error opacity-60 hover:opacity-100"
                  @click="removeResource('group', index)"
                >
                  <IconTrash :size="16" />
                </button>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="(name, bindingIndex) in group.proxies || []"
                  :key="`proxy-${name}`"
                  class="badge gap-0.5 badge-sm"
                >
                  <button
                    :disabled="bindingIndex === 0"
                    @click="
                      moveGroupBinding(
                        index,
                        'proxies',
                        Number(bindingIndex),
                        -1,
                      )
                    "
                  >
                    ‹
                  </button>
                  {{ name }}
                  <button
                    :disabled="bindingIndex === group.proxies.length - 1"
                    @click="
                      moveGroupBinding(
                        index,
                        'proxies',
                        Number(bindingIndex),
                        1,
                      )
                    "
                  >
                    ›
                  </button>
                  <button
                    class="text-error"
                    @click="removeGroupBinding(index, 'proxies', name)"
                  >
                    ×
                  </button>
                </span>
                <span
                  v-for="(name, bindingIndex) in group.use || []"
                  :key="`provider-${name}`"
                  class="badge gap-0.5 badge-sm badge-info"
                >
                  <button
                    :disabled="bindingIndex === 0"
                    @click="
                      moveGroupBinding(index, 'use', Number(bindingIndex), -1)
                    "
                  >
                    ‹
                  </button>
                  {{ name }}
                  <button
                    :disabled="bindingIndex === group.use.length - 1"
                    @click="
                      moveGroupBinding(index, 'use', Number(bindingIndex), 1)
                    "
                  >
                    ›
                  </button>
                  <button
                    class="text-error"
                    @click="removeGroupBinding(index, 'use', name)"
                  >
                    ×
                  </button>
                </span>
                <span
                  v-if="!(group.proxies?.length || group.use?.length)"
                  class="text-xs text-base-content/45"
                  >{{ t('visualEditorDropHint') }}</span
                >
              </div>
              <div class="mt-3 grid gap-2 xl:hidden">
                <select
                  class="select-bordered select select-xs"
                  :aria-label="t('visualEditorProxy')"
                  @change="selectGroupBinding(index, 'proxies', $event)"
                >
                  <option value="">+ {{ t('visualEditorProxy') }}</option>
                  <option
                    v-for="proxy in proxies"
                    :key="String(proxy.name)"
                    :value="String(proxy.name)"
                  >
                    {{ proxy.name }}
                  </option>
                </select>
                <select
                  class="select-bordered select select-xs"
                  :aria-label="t('proxyProviders')"
                  @change="selectGroupBinding(index, 'use', $event)"
                >
                  <option value="">+ {{ t('proxyProviders') }}</option>
                  <option v-for="[name] in providers" :key="name" :value="name">
                    {{ name }}
                  </option>
                </select>
              </div>
            </article>

            <div class="mt-2 flex items-center justify-between">
              <h3 class="font-semibold">{{ t('rules') }}</h3>
              <Button
                class="btn-ghost btn-xs"
                :icon="IconPlus"
                @click="addRule"
                >{{ t('add') }}</Button
              >
            </div>
            <div
              v-for="(rule, index) in rules"
              :key="`${index}-${rule}`"
              class="flex items-center gap-1 rounded-lg bg-base-100 p-2"
            >
              <input
                class="input-bordered input min-w-0 flex-1 font-mono input-xs"
                :value="rule"
                @change="
                  updateRule(index, ($event.target as HTMLInputElement).value)
                "
              />
              <button :disabled="index === 0" @click="moveRule(index, -1)">
                <IconChevronUp :size="15" />
              </button>
              <button
                :disabled="index === rules.length - 1"
                @click="moveRule(index, 1)"
              >
                <IconChevronDown :size="15" />
              </button>
              <button class="text-error" @click="removeRule(index)">
                <IconTrash :size="15" />
              </button>
            </div>

            <div class="mt-2 flex items-center justify-between">
              <h3 class="font-semibold">{{ t('ruleProviders') }}</h3>
              <div class="flex gap-1">
                <Button
                  class="btn-ghost btn-xs"
                  @click="openSection('sub-rules')"
                  >{{ t('visualEditorSubRules') }}</Button
                >
                <Button
                  class="btn-ghost btn-xs"
                  :icon="IconPlus"
                  @click="addResource('rule-provider')"
                  >{{ t('add') }}</Button
                >
              </div>
            </div>
            <article
              v-for="[name, provider] in ruleProviders"
              :key="name"
              class="rounded-xl bg-base-100 p-3"
            >
              <div class="flex items-center gap-2">
                <span class="badge badge-ghost badge-sm">{{
                  provider.behavior || provider.type
                }}</span>
                <button
                  class="min-w-0 flex-1 truncate text-start font-medium"
                  @click="openResource('rule-provider', provider, null, name)"
                >
                  {{ name }}
                </button>
                <button
                  class="text-error"
                  @click="removeResource('rule-provider', name)"
                >
                  <IconTrash :size="16" />
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <div
        v-if="diagnostics.length"
        class="rounded-2xl border border-error/30 bg-error/5 p-4"
      >
        <h2 class="mb-2 font-semibold text-error">
          {{ t('visualEditorDiagnostics') }}
        </h2>
        <ul class="space-y-1 text-sm">
          <li v-for="(item, index) in diagnostics" :key="index">
            <code>{{ item.path.join('.') }}</code> — {{ item.message }}
          </li>
        </ul>
      </div>
    </template>

    <Modal ref="sectionModal" :title="editingSection">
      <SchemaValueEditor
        v-model="sectionDraft"
        :schema="sectionSchema"
        :label="editingSection"
      />
      <template #actions>
        <Button class="btn-ghost btn-sm" @click="sectionModal?.close()">{{
          t('cancel')
        }}</Button>
        <Button class="btn-primary btn-sm" @click="saveSection">{{
          t('profilesSave')
        }}</Button>
      </template>
    </Modal>

    <Modal ref="resourceModal" :title="t('visualEditorResourceEdit')">
      <div class="flex flex-col gap-4">
        <label
          v-if="resourceKind === 'provider' || resourceKind === 'rule-provider'"
          class="form-control gap-1"
        >
          <span class="text-sm font-medium">{{ t('profilesName') }}</span>
          <input v-model="resourceName" class="input-bordered input input-sm" />
        </label>
        <template v-for="field in commonResourceFields" :key="field">
          <label class="form-control gap-1">
            <span class="text-sm font-medium">{{ field }}</span>
            <select
              v-if="field === 'type'"
              v-model="resourceDraft[field]"
              class="select-bordered select select-sm"
            >
              <option
                v-for="option in resourceKind === 'proxy'
                  ? PROXY_TYPES
                  : resourceKind === 'group'
                    ? GROUP_TYPES
                    : ['http', 'file', 'inline']"
                :key="option"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
            <input
              v-else-if="
                ['tls', 'udp', 'skip-cert-verify', 'udp-over-tcp'].includes(
                  field,
                )
              "
              v-model="resourceDraft[field]"
              type="checkbox"
              class="toggle toggle-primary toggle-sm"
            />
            <input
              v-else
              v-model="resourceDraft[field]"
              :type="
                /password|secret|private-key|psk/.test(field)
                  ? 'password'
                  : ['port', 'interval', 'mtu', 'alterId'].includes(field)
                    ? 'number'
                    : 'text'
              "
              class="input-bordered input input-sm"
            />
          </label>
        </template>
        <label v-if="resourceKind === 'group'" class="form-control gap-1">
          <span class="text-sm font-medium">proxies</span>
          <textarea
            :value="(resourceDraft.proxies || []).join('\n')"
            class="textarea-bordered textarea"
            @input="
              resourceDraft.proxies = (
                $event.target as HTMLTextAreaElement
              ).value
                .split('\n')
                .map((v) => v.trim())
                .filter(Boolean)
            "
          />
        </label>
        <label v-if="resourceKind === 'group'" class="form-control gap-1">
          <span class="text-sm font-medium">use</span>
          <textarea
            :value="(resourceDraft.use || []).join('\n')"
            class="textarea-bordered textarea"
            @input="
              resourceDraft.use = ($event.target as HTMLTextAreaElement).value
                .split('\n')
                .map((v) => v.trim())
                .filter(Boolean)
            "
          />
        </label>
        <details class="rounded-xl border border-base-content/10 p-3">
          <summary class="cursor-pointer text-sm font-semibold">
            {{ t('visualEditorAdvancedJson') }}
          </summary>
          <textarea
            v-model="resourceJson"
            class="textarea-bordered textarea mt-3 min-h-64 w-full font-mono text-xs"
            spellcheck="false"
          />
        </details>
        <p v-if="resourceError" class="text-sm text-error">
          {{ resourceError }}
        </p>
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

    <Modal ref="previewModal" :title="t('visualEditorPreview')">
      <template v-if="preview">
        <div class="mb-3 flex flex-wrap gap-2 text-xs">
          <span class="badge badge-ghost"
            >{{ preview.patch.operations.length }}
            {{ t('visualEditorOperations') }}</span
          >
          <span
            class="badge"
            :class="
              preview.diagnostics.length ? 'badge-warning' : 'badge-success'
            "
            >{{ preview.diagnostics.length }}
            {{ t('visualEditorDiagnostics') }}</span
          >
          <span
            class="badge"
            :class="preview.conflicts.length ? 'badge-error' : 'badge-success'"
            >{{ preview.conflicts.length }}
            {{ t('visualEditorConflicts') }}</span
          >
        </div>
        <pre
          class="max-h-[55vh] overflow-auto rounded-xl bg-base-300 p-3 text-xs"
          >{{ preview.composedYaml }}</pre>
      </template>
      <template #actions>
        <Button class="btn-ghost btn-sm" @click="previewModal?.close()">{{
          t('cancel')
        }}</Button>
        <Button
          class="btn-primary btn-sm"
          :loading="applying"
          :disabled="
            Boolean(
              preview?.conflicts.length ||
              preview?.diagnostics.some((d) => d.severity === 'error'),
            )
          "
          @click="applyChanges"
          >{{ activeApplyLabel }}</Button
        >
      </template>
    </Modal>
  </div>
</template>
