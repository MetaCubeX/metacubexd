<script setup lang="ts">
import type { ShortcutAction } from '~/constants/shortcuts'
import {
  formatShortcutKey,
  SHORTCUT_CATEGORIES,
  SHORTCUT_LABELS,
} from '~/constants/shortcuts'

const shortcutsStore = useShortcutsStore()
const { t } = useI18n()

// Mobile detection - hide on touch devices
const isMobile = useMediaQuery('(max-width: 768px)')

// Editing state
const editingKey = ref<ShortcutAction | null>(null)
const pendingKey = ref<string>('')
const conflictWith = ref<ShortcutAction | null>(null)

// Start editing a shortcut
const startEditing = (action: ShortcutAction) => {
  editingKey.value = action
  pendingKey.value = ''
  conflictWith.value = null
}

// Cancel editing
const cancelEditing = () => {
  editingKey.value = null
  pendingKey.value = ''
  conflictWith.value = null
}

// Handle keydown when editing
const handleKeyDown = (event: KeyboardEvent) => {
  if (!editingKey.value) return

  event.preventDefault()
  event.stopPropagation()

  const key = event.key

  // Escape cancels editing
  if (key === 'Escape') {
    cancelEditing()
    return
  }

  // Build key string
  let keyString = ''
  if (key === '?') {
    keyString = '?'
  } else if (key.length === 1) {
    keyString = key.toLowerCase()
  } else {
    keyString = key
  }

  pendingKey.value = keyString

  // Check for conflicts
  const conflict = shortcutsStore.findConflict(keyString, editingKey.value)
  if (conflict) {
    conflictWith.value = conflict
  } else {
    // Apply the change
    shortcutsStore.updateShortcut(editingKey.value, keyString)
    cancelEditing()
  }
}

// Force apply despite conflict
const forceApply = () => {
  if (editingKey.value && pendingKey.value) {
    shortcutsStore.updateShortcut(editingKey.value, pendingKey.value)
    cancelEditing()
  }
}

// Reset all shortcuts
const resetAll = () => {
  shortcutsStore.resetToDefaults()
}

// Check if shortcut is customized
const isCustomized = (action: ShortcutAction) => {
  return shortcutsStore.isCustomized(action)
}
</script>

<template>
  <!-- Hide on mobile devices -->
  <div v-if="!isMobile" class="flex flex-col gap-3">
    <div
      v-for="category in SHORTCUT_CATEGORIES"
      :key="category.id"
      class="flex flex-col gap-1"
    >
      <div class="px-2 text-xs font-medium opacity-50">
        {{ t(category.labelKey, category.id) }}
      </div>

      <div
        v-for="action in category.shortcuts"
        :key="action"
        class="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors hover:bg-base-content/5"
      >
        <div class="flex items-center gap-2 text-sm">
          <span>{{
            t(SHORTCUT_LABELS[action as ShortcutAction], action)
          }}</span>
          <span
            v-if="isCustomized(action as ShortcutAction)"
            class="badge badge-xs badge-primary"
          >
            {{ t('shortcuts.customized', 'customized') }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Editing mode -->
          <template v-if="editingKey === action">
            <div class="flex items-center gap-2">
              <kbd
                class="kbd animate-pulse border-primary kbd-sm"
                tabindex="0"
                @keydown="handleKeyDown"
              >
                {{ pendingKey || t('shortcuts.pressKey', 'Press a key...') }}
              </kbd>
              <button class="btn btn-ghost btn-xs" @click="cancelEditing">
                <span class="i-tabler-x size-4" />
              </button>
            </div>
            <!-- Conflict warning -->
            <div v-if="conflictWith" class="flex items-center gap-2">
              <span class="text-xs text-warning">
                {{ t('shortcuts.conflictWith', 'Conflicts with') }}
                {{ t(SHORTCUT_LABELS[conflictWith], conflictWith) }}
              </span>
              <button class="btn btn-xs btn-warning" @click="forceApply">
                {{ t('shortcuts.forceApply', 'Apply anyway') }}
              </button>
            </div>
          </template>

          <!-- Display mode -->
          <template v-else>
            <button
              class="btn gap-1 btn-ghost btn-xs"
              @click="startEditing(action as ShortcutAction)"
            >
              <kbd class="kbd kbd-sm">
                {{
                  formatShortcutKey(
                    shortcutsStore.shortcuts[action as ShortcutAction],
                  )
                }}
              </kbd>
              <span class="i-tabler-edit size-3 opacity-50" />
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Reset button -->
    <div class="mt-2 flex justify-end">
      <button class="btn btn-outline btn-sm btn-error" @click="resetAll">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        {{ t('shortcuts.resetToDefaults', 'Reset to Defaults') }}
      </button>
    </div>
  </div>
</template>
