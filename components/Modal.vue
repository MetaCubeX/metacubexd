<script setup lang="ts">
import { IconX } from '@tabler/icons-vue'

interface Props {
  title?: string
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const dialogRef = ref<HTMLDialogElement>()
const isOpen = ref(false)
const isRendered = ref(false)

function open() {
  dialogRef.value?.showModal()
  isRendered.value = true
  // Small delay to allow the DOM to render before animating
  requestAnimationFrame(() => {
    isOpen.value = true
  })
}

function close() {
  isOpen.value = false
  // Wait for animation to complete (matches --dur-base + small buffer)
  setTimeout(() => {
    dialogRef.value?.close()
    isRendered.value = false
    emit('close')
  }, 240)
}

defineExpose({ open, close })
</script>

<template>
  <dialog
    ref="dialogRef"
    class="modal modal-bottom sm:modal-middle"
    :style="{
      '--modal-border':
        'color-mix(in oklch, var(--color-base-content) 10%, transparent)',
    }"
  >
    <div
      class="modal-shell flex max-h-[90vh] w-[95%] max-w-2xl flex-col overflow-hidden rounded-2xl p-0 sm:w-11/12"
      :class="isOpen ? 'is-open' : ''"
      :style="{
        background: 'var(--color-base-100)',
        border: '1px solid var(--modal-border)',
        boxShadow:
          '0 25px 50px -12px color-mix(in oklch, var(--color-base-content) 25%, transparent), 0 0 0 1px var(--modal-border), inset 0 1px 0 0 color-mix(in oklch, var(--color-base-content) 6%, transparent)',
      }"
      @contextmenu.prevent
    >
      <!-- Header -->
      <div
        class="sticky top-0 z-10 flex items-center justify-between px-5 py-4 max-sm:pt-[max(1rem,env(safe-area-inset-top))]"
        :style="{
          background: 'var(--color-base-200)',
          borderBottom: '1px solid var(--modal-border)',
        }"
      >
        <div
          class="flex items-center gap-3 text-lg font-bold text-base-content [&>svg]:text-primary"
        >
          <slot name="icon" />
          <span>{{ title }}</span>
        </div>

        <button
          class="modal-close flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-transparent"
          :style="{
            border: '1px solid var(--modal-border)',
            color:
              'color-mix(in oklch, var(--color-base-content) 60%, transparent)',
          }"
          @click="close"
        >
          <IconX :size="18" />
        </button>
      </div>

      <!-- Content -->
      <div v-if="isRendered" class="flex-1 overflow-y-auto p-5">
        <slot />
      </div>

      <!-- Actions -->
      <div
        v-if="isRendered && $slots.actions"
        class="sticky bottom-0 z-10 flex items-center justify-end px-5 py-4"
        :style="{
          background: 'var(--color-base-200)',
          borderTop: '1px solid var(--modal-border)',
        }"
      >
        <div class="flex justify-end gap-2">
          <slot name="actions" />
        </div>
      </div>
    </div>

    <form
      method="dialog"
      class="fixed inset-0 modal-backdrop -z-[1]"
      :style="{
        background:
          'color-mix(in oklch, var(--color-base-content) 50%, transparent)',
      }"
    >
      <button
        class="absolute inset-0 h-full w-full cursor-pointer border-none bg-transparent"
        @click="close"
      />
    </form>
  </dialog>
</template>

<style scoped>
/* Modal shell: spring entrance with light blur, gentle exit */
.modal-shell {
  opacity: 0;
  transform: translateY(16px) scale(0.94);
  filter: blur(4px);
  transition:
    opacity var(--dur-base) var(--ease-soft),
    transform var(--dur-slow) var(--ease-spring),
    filter var(--dur-base) var(--ease-soft);
}
.modal-shell.is-open {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

/* Backdrop fade — pairs with shell timing */
.modal-backdrop {
  backdrop-filter: blur(0px);
  transition: backdrop-filter var(--dur-slow) var(--ease-soft);
}
dialog[open] .modal-backdrop {
  backdrop-filter: blur(8px);
}

/* Close button — rotate + tactile press, error tint on hover */
.modal-close {
  transition:
    transform var(--dur-base) var(--ease-spring),
    color var(--dur-fast) var(--ease-soft),
    background-color var(--dur-fast) var(--ease-soft),
    border-color var(--dur-fast) var(--ease-soft);
}
.modal-close:hover {
  transform: rotate(90deg);
  color: var(--color-error);
  background-color: color-mix(in oklch, var(--color-error) 15%, transparent);
  border-color: color-mix(
    in oklch,
    var(--color-error) 30%,
    transparent
  ) !important;
}
.modal-close:active {
  transform: rotate(90deg) scale(0.88);
  transition-duration: var(--dur-instant);
  transition-timing-function: var(--ease-press);
}
</style>
