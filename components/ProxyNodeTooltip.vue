<script setup lang="ts">
import {
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from '@floating-ui/vue'

interface Props {
  // Anchor element the tooltip is positioned against. This component is meant to
  // be mounted lazily (v-if) only while the tooltip is open, so the expensive
  // floating-ui setup is paid per-open instead of once per node card.
  reference: HTMLElement | null
}

const props = defineProps<Props>()

defineEmits<{
  mouseEnter: []
  mouseLeave: []
}>()

// This tooltip teleports to <body>, escaping the layout root that carries the
// font-twemoji / font-default class. Re-apply it here so node-name flag emoji
// render with Twemoji to match the cards (#2017).
const configStore = useConfigStore()

const referenceEl = toRef(props, 'reference')
const floating = ref<HTMLElement | null>(null)
const floatingArrow = ref<HTMLElement | null>(null)

const { floatingStyles, middlewareData, placement } = useFloating(
  referenceEl,
  floating,
  {
    placement: 'top',
    strategy: 'fixed',
    // Position via top/left; the floating element runs animate-pop-in, whose
    // transform would otherwise override floating-ui's translate.
    transform: false,
    middleware: [
      offset(10),
      flip(),
      shift({ padding: 8 }),
      arrow({ element: floatingArrow }),
    ],
    whileElementsMounted: autoUpdate,
  },
)

const arrowStyles = computed(() => {
  const arrowData = middlewareData.value.arrow
  const side = placement.value.split('-')[0] || 'top'

  const staticSide: Record<string, string> = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }

  const sideKey = staticSide[side] || 'bottom'

  return {
    left: arrowData?.x != null ? `${arrowData.x}px` : '',
    top: arrowData?.y != null ? `${arrowData.y}px` : '',
    [sideKey]: '-4px',
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="floating"
      data-proxy-tooltip
      :style="floatingStyles"
      class="animate-pop-in z-50 w-max max-w-80 rounded-xl bg-primary p-3 text-primary-content shadow-[0_10px_40px_color-mix(in_oklch,var(--color-base-content)_30%,transparent)]"
      :class="configStore.enableTwemoji ? 'font-twemoji' : 'font-default'"
      @mouseenter="$emit('mouseEnter')"
      @mouseleave="$emit('mouseLeave')"
    >
      <!-- Arrow -->
      <div
        ref="floatingArrow"
        class="absolute size-2 rotate-45 bg-primary"
        :style="arrowStyles"
      />

      <slot />
    </div>
  </Teleport>
</template>
