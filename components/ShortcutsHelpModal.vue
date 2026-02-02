<script setup lang="ts">
import type {ShortcutAction} from '~/constants/shortcuts';
import {
  formatShortcutKey,
  SHORTCUT_CATEGORIES,
  SHORTCUT_LABELS
  
} from '~/constants/shortcuts'

const shortcutsStore = useShortcutsStore()
const { t } = useI18n()

// Mobile detection - don't show on mobile
const isMobile = useMediaQuery('(max-width: 768px)')

const close = () => {
  shortcutsStore.closeHelpModal()
}
</script>

<template>
  <!-- Don't show on mobile devices -->
  <dialog
    v-if="!isMobile"
    class="modal"
    :class="{ 'modal-open': shortcutsStore.isHelpModalOpen }"
    @click.self="close"
  >
    <div class="modal-box max-w-lg">
      <div
        class="flex items-center justify-between border-b border-base-300 pb-3"
      >
        <h3 class="text-lg font-bold">
          {{ t('shortcuts.title', 'Keyboard Shortcuts') }}
        </h3>
        <button class="btn btn-circle btn-ghost btn-sm" @click="close">
          <span class="i-tabler-x size-5" />
        </button>
      </div>

      <div class="mt-4 space-y-6">
        <div v-for="category in SHORTCUT_CATEGORIES" :key="category.id">
          <h4 class="mb-2 text-sm font-semibold text-base-content/70">
            {{ t(category.labelKey, category.id) }}
          </h4>
          <div class="space-y-1">
            <div
              v-for="action in category.shortcuts"
              :key="action"
              class="flex items-center justify-between rounded px-2 py-1.5 hover:bg-base-200"
            >
              <span class="text-sm">
                {{ t(SHORTCUT_LABELS[action as ShortcutAction], action) }}
              </span>
              <kbd class="kbd kbd-sm">
                {{
                  formatShortcutKey(
                    shortcutsStore.shortcuts[action as ShortcutAction],
                  )
                }}
              </kbd>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 text-center text-xs text-base-content/50">
        {{ t('shortcuts.pressEscToClose', 'Press Esc to close') }}
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close">
      <button>close</button>
    </form>
  </dialog>
</template>
