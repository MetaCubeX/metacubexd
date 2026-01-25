<script setup lang="ts">
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { IconLanguage } from '@tabler/icons-vue'

const { locale, locales, setLocale } = useI18n()

const availableLocales = computed(() =>
  locales.value.map((l) => (typeof l === 'string' ? { code: l, name: l } : l)),
)

// Floating UI setup
const reference = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const { floatingStyles } = useFloating(reference, floating, {
  placement: 'top',
  middleware: [offset(10), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function selectLocale(code: string) {
  setLocale(code as 'en' | 'zh' | 'ru')
  isOpen.value = false
}

// Close menu when clicking outside
function onClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (!reference.value?.contains(target) && !floating.value?.contains(target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div class="relative">
    <button
      ref="reference"
      class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-base-content/70 transition-all duration-200 ease-in-out hover:bg-base-content/10 hover:text-base-content"
      :class="{ 'bg-primary/15 text-primary': isOpen }"
      aria-label="Change language"
      @click.stop="toggleMenu"
    >
      <IconLanguage :size="18" />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          ref="floating"
          :style="floatingStyles"
          class="z-70 w-40 overflow-hidden rounded-xl border border-base-content/10 bg-base-300/98 shadow-[0_10px_40px_var(--color-base-content)/20,0_0_0_1px_var(--color-base-content)/5] backdrop-blur-[12px]"
        >
          <div
            class="flex items-center border-b border-base-content/8 bg-base-200/60 px-3 py-2.5"
          >
            <span
              class="text-[0.6875rem] font-semibold tracking-[0.05em] text-base-content/50 uppercase"
              >Language</span
            >
          </div>
          <ul class="m-0 list-none p-1.5">
            <li v-for="lang in availableLocales" :key="lang.code">
              <button
                class="flex w-full cursor-pointer items-center justify-between rounded-lg border-none bg-transparent px-2.5 py-2 transition-all duration-150 ease-in-out hover:bg-base-content/8"
                :class="{
                  'bg-primary/15 hover:bg-primary/20': locale === lang.code,
                }"
                @click="selectLocale(lang.code)"
              >
                <span
                  class="text-[0.8125rem] font-medium text-base-content"
                  :class="{ 'text-primary': locale === lang.code }"
                  >{{ lang.name }}</span
                >
                <div
                  v-if="locale === lang.code"
                  class="flex h-4 w-4 items-center justify-center text-primary"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="h-full w-full"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
