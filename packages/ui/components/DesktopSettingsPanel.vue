<!-- packages/ui/components/DesktopSettingsPanel.vue -->
<script setup lang="ts">
import { IconKeyboard, IconSettings } from '@tabler/icons-vue'

const { t } = useI18n()
const { settings, hotkeys, isMac } = useDesktop()

// ---- Desktop-shell toggles ------------------------------------------------
const shellSettings = reactive({
  silentUpdateCheck: true,
  tunAutoRestore: false,
  showTraySpeed: true,
})
const settingsLoaded = ref(false)

const TOGGLES = [
  {
    key: 'silentUpdateCheck',
    label: 'desktopSilentUpdateCheck',
    desc: 'desktopSilentUpdateCheckDesc',
  },
  {
    key: 'tunAutoRestore',
    label: 'desktopTunAutoRestore',
    desc: 'desktopTunAutoRestoreDesc',
  },
  {
    key: 'showTraySpeed',
    label: 'desktopShowTraySpeed',
    desc: 'desktopShowTraySpeedDesc',
  },
] as const

const onToggle = async (key: keyof typeof shellSettings, event: Event) => {
  if (!settings) return
  const value = (event.target as HTMLInputElement).checked
  const next = await settings.set({ [key]: value })
  Object.assign(shellSettings, next)
}

// ---- Global hotkeys ---------------------------------------------------------
const HOTKEY_ACTIONS = [
  { action: 'toggleSystemProxy', label: 'desktopHotkeyToggleSystemProxy' },
  { action: 'cycleProxyMode', label: 'desktopHotkeyCycleProxyMode' },
  { action: 'toggleWindow', label: 'desktopHotkeyToggleWindow' },
] as const

const bindings = reactive<Record<string, string>>({})
const defaults = ref<Record<string, string>>({})
const failed = ref<{ action: string; accelerator: string }[]>([])
const recording = ref<string | null>(null)
const hotkeysDirty = ref(false)
const hotkeysSaving = ref(false)

const applyPayload = (payload: {
  bindings: Record<string, string>
  defaults: Record<string, string>
  failed: { action: string; accelerator: string }[]
}) => {
  Object.assign(bindings, payload.bindings)
  defaults.value = payload.defaults
  failed.value = payload.failed
}

onMounted(async () => {
  if (settings) {
    Object.assign(shellSettings, await settings.get())
    settingsLoaded.value = true
  }
  if (hotkeys) applyPayload(await hotkeys.get())
})

// Pretty-print an Electron accelerator for the current platform.
const formatAccelerator = (accelerator: string): string => {
  if (!accelerator) return t('desktopHotkeyDisabled')
  return accelerator
    .replaceAll('CommandOrControl', isMac ? '⌘' : 'Ctrl')
    .replaceAll('Command', '⌘')
    .replaceAll('Control', isMac ? '⌃' : 'Ctrl')
    .replaceAll('Alt', isMac ? '⌥' : 'Alt')
    .replaceAll('Shift', isMac ? '⇧' : 'Shift')
    .replaceAll('+', isMac ? '' : '+')
}

const isConflict = (action: string) =>
  failed.value.some((f) => f.action === action)

// Build an Electron accelerator from a keydown. Pure-modifier presses return
// null (wait for the real key); modifier-less single characters are rejected
// too — a GLOBAL hotkey without modifiers would swallow normal typing OS-wide.
const acceleratorFromEvent = (event: KeyboardEvent): string | null => {
  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  const key = event.key
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) return null
  if (parts.length === 0) return null
  let keyName = key
  if (key.length === 1) keyName = key.toUpperCase()
  else if (key === 'ArrowUp') keyName = 'Up'
  else if (key === 'ArrowDown') keyName = 'Down'
  else if (key === 'ArrowLeft') keyName = 'Left'
  else if (key === 'ArrowRight') keyName = 'Right'
  else if (key === ' ') keyName = 'Space'
  parts.push(keyName)
  return parts.join('+')
}

const onRecordKeydown = (event: KeyboardEvent) => {
  if (!recording.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    recording.value = null
    return
  }
  // Backspace/Delete clears the binding (empty accelerator = disabled).
  if (event.key === 'Backspace' || event.key === 'Delete') {
    bindings[recording.value] = ''
    recording.value = null
    hotkeysDirty.value = true
    return
  }
  const accelerator = acceleratorFromEvent(event)
  if (!accelerator) return
  bindings[recording.value] = accelerator
  recording.value = null
  hotkeysDirty.value = true
}

const startRecording = (action: string) => {
  recording.value = recording.value === action ? null : action
}

const saveHotkeys = async () => {
  if (!hotkeys) return
  hotkeysSaving.value = true
  try {
    applyPayload(await hotkeys.set({ ...bindings }))
    hotkeysDirty.value = false
  } finally {
    hotkeysSaving.value = false
  }
}

const resetHotkeys = async () => {
  if (!hotkeys) return
  hotkeysSaving.value = true
  try {
    applyPayload(await hotkeys.set({ ...defaults.value }))
    hotkeysDirty.value = false
  } finally {
    hotkeysSaving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Shell behavior toggles -->
    <div
      v-if="settings"
      class="rounded-xl border border-base-content/10 bg-base-200 p-4"
    >
      <div class="mb-3 flex items-center gap-2 font-semibold text-base-content">
        <IconSettings :size="18" />
        {{ t('desktopBehavior') }}
      </div>
      <div class="flex flex-col gap-3">
        <label
          v-for="item in TOGGLES"
          :key="item.key"
          class="flex cursor-pointer items-center justify-between gap-4"
        >
          <span class="flex flex-col">
            <span class="text-sm text-base-content">{{ t(item.label) }}</span>
            <span class="text-xs text-base-content/60">{{ t(item.desc) }}</span>
          </span>
          <input
            type="checkbox"
            class="toggle toggle-primary"
            :checked="shellSettings[item.key]"
            :disabled="!settingsLoaded"
            @change="onToggle(item.key, $event)"
          />
        </label>
      </div>
    </div>

    <!-- Global hotkeys -->
    <div
      v-if="hotkeys"
      class="rounded-xl border border-base-content/10 bg-base-200 p-4"
      @keydown="onRecordKeydown"
    >
      <div class="mb-1 flex items-center gap-2 font-semibold text-base-content">
        <IconKeyboard :size="18" />
        {{ t('desktopHotkeys') }}
      </div>
      <p class="mb-3 text-xs text-base-content/60">
        {{ t('desktopHotkeysDesc') }}
      </p>
      <div class="flex flex-col gap-2">
        <div
          v-for="item in HOTKEY_ACTIONS"
          :key="item.action"
          class="flex items-center justify-between gap-4"
        >
          <span class="text-sm text-base-content">{{ t(item.label) }}</span>
          <span class="flex items-center gap-2">
            <span
              v-if="isConflict(item.action)"
              class="badge badge-sm badge-error"
            >
              {{ t('desktopHotkeyConflict') }}
            </span>
            <button
              type="button"
              class="btn min-w-36 btn-sm"
              :class="{ 'btn-primary': recording === item.action }"
              @click="startRecording(item.action)"
            >
              <template v-if="recording === item.action">
                {{ t('desktopHotkeyPressKeys') }}
              </template>
              <template v-else>
                <kbd v-if="bindings[item.action]" class="kbd kbd-sm">
                  {{ formatAccelerator(bindings[item.action] ?? '') }}
                </kbd>
                <span v-else class="text-base-content/50">
                  {{ t('desktopHotkeyDisabled') }}
                </span>
              </template>
            </button>
          </span>
        </div>
      </div>
      <p v-if="recording" class="mt-2 text-xs text-base-content/60">
        {{ t('desktopHotkeyRecordHint') }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <Button
          class="btn-primary btn-sm"
          :disabled="!hotkeysDirty"
          :loading="hotkeysSaving"
          @click="saveHotkeys"
        >
          {{ t('desktopHotkeySave') }}
        </Button>
        <Button
          class="btn-ghost btn-sm"
          :loading="hotkeysSaving"
          @click="resetHotkeys"
        >
          {{ t('desktopHotkeyReset') }}
        </Button>
      </div>
    </div>
  </div>
</template>
