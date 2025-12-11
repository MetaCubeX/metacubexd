<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
import mihomoSchema from '~/schemas/mihomo.schema.json'

const props = defineProps<{
  modelValue: string
  language?: string
  readOnly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null

// Configure YAML language support with custom schema
const configureYaml = () => {
  configureMonacoYaml(monaco, {
    enableSchemaRequest: false,
    schemas: [
      {
        uri: 'https://metacubex.github.io/mihomo.schema.json',
        fileMatch: ['*'],
        schema: mihomoSchema as unknown as Record<string, unknown>,
      },
    ],
  })
}

// Get current theme
const colorMode = useColorMode()
const editorTheme = computed(() => {
  return colorMode.value === 'dark' ? 'vs-dark' : 'vs'
})

onMounted(() => {
  if (!editorContainer.value) return

  // Configure YAML before creating editor
  configureYaml()

  // Create editor instance
  editorInstance = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language || 'yaml',
    theme: editorTheme.value,
    readOnly: props.readOnly ?? false,
    automaticLayout: true,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineNumbers: 'on',
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    folding: true,
    formatOnPaste: true,
    formatOnType: true,
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
  })

  // Listen for content changes
  editorInstance.onDidChangeModelContent(() => {
    if (editorInstance) {
      emit('update:modelValue', editorInstance.getValue())
    }
  })
})

// Watch for theme changes
watch(editorTheme, (newTheme) => {
  monaco.editor.setTheme(newTheme)
})

// Watch for external value changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (editorInstance && editorInstance.getValue() !== newValue) {
      editorInstance.setValue(newValue)
    }
  },
)

// Watch for readOnly changes
watch(
  () => props.readOnly,
  (newValue) => {
    if (editorInstance) {
      editorInstance.updateOptions({ readOnly: newValue ?? false })
    }
  },
)

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
  }
})

// Expose methods
defineExpose({
  getEditor: () => editorInstance,
  getValue: () => editorInstance?.getValue() ?? '',
  setValue: (value: string) => editorInstance?.setValue(value),
  focus: () => editorInstance?.focus(),
})
</script>

<template>
  <div ref="editorContainer" class="h-full min-h-[400px] w-full" />
</template>
