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

// Longest exit transition is the shell transform (--dur-slow = 320ms); add a buffer.
const EXIT_DURATION = 360
let closeTimer: ReturnType<typeof setTimeout> | undefined

function prefersReducedMotion() {
  return (
    import.meta.client &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function cancelCloseTimer() {
  if (closeTimer !== undefined) {
    clearTimeout(closeTimer)
    closeTimer = undefined
  }
}

function open() {
  // Cancel a pending teardown so a fast close -> re-open doesn't self-close.
  cancelCloseTimer()
  dialogRef.value?.showModal()
  isRendered.value = true
  // Next frame: flip to the open state so the entrance transition runs.
  requestAnimationFrame(() => {
    isOpen.value = true
  })
}

function close() {
  isOpen.value = false
  cancelCloseTimer()
  // Wait for the exit transition to finish before unmounting the dialog.
  closeTimer = setTimeout(
    () => {
      closeTimer = undefined
      dialogRef.value?.close()
      isRendered.value = false
      emit('close')
    },
    prefersReducedMotion() ? 0 : EXIT_DURATION,
  )
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
      <div
        v-if="isRendered"
        class="flex-1 overflow-y-auto p-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <slot />
      </div>

      <!-- Actions -->
      <div
        v-if="isRendered && $slots.actions"
        class="sticky bottom-0 z-10 flex items-center justify-end px-5 py-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
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
      :class="isOpen ? 'is-open' : ''"
    >
      <button
        class="absolute inset-0 h-full w-full cursor-pointer border-none bg-transparent"
        @click="close"
      />
    </form>
  </dialog>
</template>

<style scoped>
/* Neutralize daisyUI's built-in [open] dim (oklch(0% 0 0/.4)) so the custom
   backdrop below is the single, coordinated scrim — no double-darkening and no
   desynced fades between daisyUI's curve and ours. */
.modal {
  background-color: transparent !important;
}

/* Modal shell: spring entrance using only composited transform + opacity.
   The previous filter: blur() animation forced an extra offscreen rasterization
   pass every frame and is the reason opening felt janky — removed. */
.modal-shell {
  opacity: 0;
  transform: translateY(16px) scale(0.94);
  transition:
    opacity var(--dur-base) var(--ease-soft),
    transform var(--dur-slow) var(--ease-spring);
  will-change: transform, opacity;
}
.modal-shell.is-open {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Backdrop: a single neutral scrim faded purely via opacity (GPU-composited,
   cheap). Theme-independent dark so it dims correctly on every daisyUI theme.
   It replaces the old animated backdrop-filter: blur(8px), which re-blurred the
   entire page (hundreds of proxy cards) every frame — the dominant lag source —
   and, by sampling over the fixed bottom nav's own backdrop-filter, produced the
   bottom-content rendering artifact. A solid scrim in the top layer dims the nav
   uniformly with no sampling, fixing both. */
.modal-backdrop {
  background: oklch(0% 0 0 / 0.5);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-soft);
  will-change: opacity;
}
.modal-backdrop.is-open {
  opacity: 1;
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
