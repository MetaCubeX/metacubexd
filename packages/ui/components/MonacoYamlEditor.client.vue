<!-- packages/ui/components/MonacoYamlEditor.client.vue -->
<script setup lang="ts">
// `.client` suffix: Nuxt still evaluates setup during prerender, but monaco
// (which touches self/Worker) is only imported inside onMounted, never at
// module load. import('~/utils/monaco-setup') => monaco in its own async chunk.
import type * as MonacoNs from 'monaco-editor'

const props = withDefaults(
  defineProps<{
    modelValue: string
    readOnly?: boolean
    // 'yaml' (default) wires the meta-json-schema validation; 'javascript'
    // edits script-profile transforms with JS syntax highlighting (no schema).
    language?: 'yaml' | 'javascript'
  }>(),
  { readOnly: false, language: 'yaml' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()
const configStore = useConfigStore()
const preferredDark = usePreferredDark()

const container = ref<HTMLElement>()
const disableValidation = ref(false)

let monaco: typeof MonacoNs | null = null
let editor: MonacoNs.editor.IStandaloneCodeEditor | null = null
let model: MonacoNs.editor.ITextModel | null = null

// daisyUI v5 emits `color-scheme: light|dark` per named theme. Read it AFTER
// mount; fall back to the user's OS preference.
function resolveTheme(): 'vs' | 'vs-dark' {
  if (typeof document !== 'undefined') {
    const scheme = getComputedStyle(document.documentElement).colorScheme
    if (scheme.includes('dark')) return 'vs-dark'
    if (scheme.includes('light')) return 'vs'
  }
  return preferredDark.value ? 'vs-dark' : 'vs'
}

onMounted(async () => {
  const setup = await import('~/utils/monaco-setup')
  monaco = setup.ensureMonacoYaml()

  // Distinct per-language URI: the yaml schema only fileMatches *.yaml, so a JS
  // model lives at a .js URI (no yaml worker / schema attached to it).
  const isJs = props.language === 'javascript'
  const uri = monaco.Uri.parse(
    isJs ? 'inmemory://profile/script.js' : 'inmemory://profile/config.yaml',
  )
  model =
    monaco.editor.getModel(uri) ??
    monaco.editor.createModel(
      props.modelValue,
      isJs ? 'javascript' : 'yaml',
      uri,
    )
  model.setValue(props.modelValue)

  editor = monaco.editor.create(container.value!, {
    model,
    theme: resolveTheme(),
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    tabSize: 2,
  })

  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor!.getValue())
  })
})

onBeforeUnmount(() => {
  editor?.dispose()
  model?.dispose()
  editor = null
  model = null
})

// Keep external v-model changes in sync without clobbering the cursor.
watch(
  () => props.modelValue,
  (val) => {
    if (model && val !== model.getValue()) model.setValue(val)
  },
)

watch(
  () => props.readOnly,
  (ro) => editor?.updateOptions({ readOnly: ro }),
)

// Theme sync: re-resolve when the daisyUI theme or OS preference changes.
watch([() => configStore.curTheme, preferredDark], async () => {
  await nextTick()
  monaco?.editor.setTheme(resolveTheme())
})

// "Disable validation" toggle: re-run configureMonacoYaml's validate flag by
// toggling the model's markers off. monaco-yaml validation is global; the
// pragmatic switch is to set the model language to plaintext (no schema) and
// back. We keep it simple: toggle the editor option that hides squiggles.
// Only meaningful for yaml — a JS model has no yaml schema to detach.
watch(disableValidation, (off) => {
  if (!monaco || !model || props.language !== 'yaml') return
  // Setting the model language to 'plaintext' detaches the yaml worker
  // (no diagnostics); back to 'yaml' re-attaches schema validation.
  monaco.editor.setModelLanguage(model, off ? 'plaintext' : 'yaml')
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-end gap-3 text-xs">
      <label
        v-if="language === 'yaml'"
        class="flex cursor-pointer items-center gap-1"
      >
        <input
          v-model="disableValidation"
          type="checkbox"
          class="toggle toggle-xs"
        />
        {{ t('editorDisableValidation') }}
      </label>
      <span v-if="readOnly" class="badge badge-ghost badge-sm">
        {{ t('editorReadOnly') }}
      </span>
    </div>
    <div
      ref="container"
      class="h-[60vh] w-full overflow-hidden rounded-lg border border-base-content/10"
    />
  </div>
</template>
