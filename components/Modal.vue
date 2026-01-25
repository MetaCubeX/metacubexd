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

function open() {
  dialogRef.value?.showModal()
  isOpen.value = true
}

function close() {
  isOpen.value = false
  // Wait for animation to complete
  setTimeout(() => {
    dialogRef.value?.close()
    emit('close')
  }, 200)
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
      class="flex max-h-[90vh] flex-col overflow-hidden rounded-2xl p-0 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :class="
        isOpen
          ? 'translate-y-0 scale-100 opacity-100'
          : 'translate-y-2.5 scale-95 opacity-0'
      "
      :style="{
        background:
          'color-mix(in oklch, var(--color-base-100) 98%, transparent)',
        border: '1px solid var(--modal-border)',
        boxShadow:
          '0 25px 50px -12px color-mix(in oklch, var(--color-base-content) 25%, transparent), 0 0 0 1px var(--modal-border)',
        backdropFilter: 'blur(16px)',
      }"
      @contextmenu.prevent
    >
      <!-- Header -->
      <div
        class="sticky top-0 z-10 flex items-center justify-between px-5 py-4 max-sm:pt-[max(1rem,env(safe-area-inset-top))]"
        :style="{
          background:
            'color-mix(in oklch, var(--color-base-200) 80%, transparent)',
          borderBottom: '1px solid var(--modal-border)',
          backdropFilter: 'blur(12px)',
        }"
      >
        <div
          class="flex items-center gap-3 text-lg font-bold text-base-content [&>svg]:text-primary"
        >
          <slot name="icon" />
          <span>{{ title }}</span>
        </div>

        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-transparent transition-all duration-200 ease-in-out hover:rotate-90 hover:text-error"
          :style="{
            border: '1px solid var(--modal-border)',
            color:
              'color-mix(in oklch, var(--color-base-content) 60%, transparent)',
          }"
          @mouseover="
            ;($event.target as HTMLElement).style.background =
              'color-mix(in oklch, var(--color-error) 15%, transparent)'
            ;($event.target as HTMLElement).style.borderColor =
              'color-mix(in oklch, var(--color-error) 30%, transparent)'
          "
          @mouseleave="
            ;($event.target as HTMLElement).style.background = 'transparent'
            ;($event.target as HTMLElement).style.borderColor =
              'var(--modal-border)'
          "
          @click="close"
        >
          <IconX :size="18" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-5">
        <slot />
      </div>

      <!-- Actions -->
      <div
        v-if="$slots.actions"
        class="sticky bottom-0 z-10 flex items-center justify-end px-5 py-4"
        :style="{
          background:
            'color-mix(in oklch, var(--color-base-200) 80%, transparent)',
          borderTop: '1px solid var(--modal-border)',
          backdropFilter: 'blur(12px)',
        }"
      >
        <div class="flex justify-end gap-2">
          <slot name="actions" />
        </div>
      </div>
    </div>

    <form
      method="dialog"
      class="fixed inset-0 modal-backdrop -z-[1] backdrop-blur-[8px]"
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
