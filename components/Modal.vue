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

function open() {
  dialogRef.value?.showModal()
}

function close() {
  dialogRef.value?.close()
  emit('close')
}

defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialogRef" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box p-0" @contextmenu.prevent>
      <!-- Header -->
      <div
        class="sticky top-0 z-50 flex items-center justify-between bg-base-100/80 p-4 backdrop-blur"
        :style="{ 'padding-top': 'max(1rem, env(safe-area-inset-top))' }"
      >
        <div class="flex items-center gap-4 text-xl font-bold">
          <slot name="icon" />
          <span>{{ title }}</span>
        </div>

        <Button class="btn-circle btn-sm" @click="close">
          <IconX :size="20" />
        </Button>
      </div>

      <!-- Content -->
      <div class="p-4">
        <slot />
      </div>

      <!-- Actions -->
      <div
        v-if="$slots.actions"
        class="sticky bottom-0 z-50 flex items-center justify-end bg-base-100/80 p-4 backdrop-blur"
      >
        <div class="flex justify-end gap-2">
          <slot name="actions" />
        </div>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button />
    </form>
  </dialog>
</template>
