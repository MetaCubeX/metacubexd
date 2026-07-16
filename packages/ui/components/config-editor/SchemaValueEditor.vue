<script setup lang="ts">
import type { ConfigJsonSchema } from '~/utils/configSchema'
import { defaultForSchema, resolveConfigSchema } from '~/utils/configSchema'

defineOptions({ name: 'SchemaValueEditor' })

const props = defineProps<{
  modelValue: unknown
  schema?: ConfigJsonSchema
  label?: string
  depth?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
const { t } = useI18n()
const depth = computed(() => props.depth ?? 0)
const resolved = computed(() =>
  resolveConfigSchema(props.schema, props.modelValue),
)
const type = computed(() => {
  const declared = resolved.value.type
  if (Array.isArray(declared)) return declared.find((item) => item !== 'null')
  if (declared) return declared
  if (Array.isArray(props.modelValue)) return 'array'
  if (typeof props.modelValue === 'object' && props.modelValue !== null)
    return 'object'
  return typeof props.modelValue
})

const objectValue = computed<Record<string, unknown>>(() =>
  typeof props.modelValue === 'object' &&
  props.modelValue !== null &&
  !Array.isArray(props.modelValue)
    ? (props.modelValue as Record<string, unknown>)
    : {},
)
const properties = computed(() => resolved.value.properties ?? {})
const propertyKeys = computed(() => Object.keys(properties.value))
const existingKeys = computed(() => Object.keys(objectValue.value))
const missingKeys = computed(() =>
  propertyKeys.value.filter((key) => !(key in objectValue.value)),
)
const newField = ref('')
const jsonText = ref('')
const jsonError = ref('')

watch(
  () => props.modelValue,
  (value) => {
    if (
      type.value === 'array' ||
      (type.value === 'object' && !propertyKeys.value.length)
    ) {
      jsonText.value = JSON.stringify(
        value ?? (type.value === 'array' ? [] : {}),
        null,
        2,
      )
    }
  },
  { immediate: true, deep: true },
)

function updateObject(key: string, value: unknown) {
  emit('update:modelValue', { ...objectValue.value, [key]: value })
}

function removeObjectKey(key: string) {
  const next = { ...objectValue.value }
  delete next[key]
  emit('update:modelValue', next)
}

function addField() {
  const key = newField.value
  if (!key) return
  updateObject(key, defaultForSchema(properties.value[key] ?? {}))
  newField.value = ''
}

function updateJson() {
  try {
    const value = JSON.parse(jsonText.value)
    if (type.value === 'array' && !Array.isArray(value))
      throw new Error('Expected an array')
    if (
      type.value === 'object' &&
      (typeof value !== 'object' || value === null || Array.isArray(value))
    ) {
      throw new Error('Expected an object')
    }
    jsonError.value = ''
    emit('update:modelValue', value)
  } catch (error) {
    jsonError.value = error instanceof Error ? error.message : String(error)
  }
}

function updateScalar(event: Event) {
  const input = event.target as HTMLInputElement
  if (type.value === 'integer' || type.value === 'number') {
    emit('update:modelValue', Number(input.value))
  } else {
    emit('update:modelValue', input.value)
  }
}

function updateEnum(event: Event) {
  const select = event.target as HTMLSelectElement
  emit('update:modelValue', resolved.value.enum?.[select.selectedIndex])
}

const sensitive = computed(() =>
  /password|secret|private-key|token|authorization/i.test(props.label ?? ''),
)
</script>

<template>
  <div
    class="flex flex-col gap-1.5"
    :class="depth ? 'rounded-lg border border-base-content/10 p-3' : ''"
  >
    <div v-if="label" class="flex items-start justify-between gap-2">
      <div>
        <label class="text-sm font-medium">{{ label }}</label>
        <p v-if="resolved.description" class="text-xs text-base-content/55">
          {{ resolved.description }}
        </p>
      </div>
    </div>

    <template v-if="type === 'object' && propertyKeys.length">
      <div v-for="key in existingKeys" :key="key" class="relative">
        <SchemaValueEditor
          :model-value="objectValue[key]"
          :schema="properties[key]"
          :label="key"
          :depth="depth + 1"
          @update:model-value="updateObject(key, $event)"
        />
        <button
          type="button"
          class="absolute end-2 top-2 rounded px-1.5 text-xs text-error hover:bg-error/10"
          :aria-label="`Remove ${key}`"
          @click="removeObjectKey(key)"
        >
          ×
        </button>
      </div>
      <div v-if="missingKeys.length" class="flex gap-2">
        <select
          v-model="newField"
          class="select-bordered select flex-1 select-sm"
        >
          <option value="">{{ t('visualEditorAddField') }}</option>
          <option v-for="key in missingKeys" :key="key" :value="key">
            {{ key }}
          </option>
        </select>
        <Button class="btn-sm" :disabled="!newField" @click="addField">
          {{ t('add') }}
        </Button>
      </div>
    </template>

    <template v-else-if="type === 'array' || type === 'object'">
      <textarea
        v-model="jsonText"
        class="textarea-bordered textarea min-h-32 w-full font-mono text-xs"
        spellcheck="false"
        @blur="updateJson"
      />
      <p v-if="jsonError" class="text-xs text-error">{{ jsonError }}</p>
    </template>

    <select
      v-else-if="resolved.enum"
      class="select-bordered select select-sm"
      :value="modelValue as any"
      @change="updateEnum"
    >
      <option
        v-for="option in resolved.enum"
        :key="String(option)"
        :value="option as any"
      >
        {{ option }}
      </option>
    </select>

    <input
      v-else-if="type === 'boolean'"
      type="checkbox"
      class="toggle toggle-primary toggle-sm"
      :checked="Boolean(modelValue)"
      @change="
        emit('update:modelValue', ($event.target as HTMLInputElement).checked)
      "
    />

    <input
      v-else
      class="input-bordered input w-full input-sm"
      :type="
        sensitive
          ? 'password'
          : type === 'integer' || type === 'number'
            ? 'number'
            : 'text'
      "
      :value="modelValue as any"
      @input="updateScalar"
    />
  </div>
</template>
