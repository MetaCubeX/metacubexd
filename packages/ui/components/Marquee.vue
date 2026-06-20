<script setup lang="ts">
// ponytail: replaces the vue3-marquee dep. Scrolls its slot content only when
// it overflows the container (the lib's `animate-on-overflow-only`); a second
// copy + translateX(-50%) makes the loop seamless. Everything else is CSS.
const root = ref<HTMLElement>()
const overflowing = ref(false)

function check() {
  const el = root.value
  if (el) overflowing.value = el.scrollWidth > el.clientWidth
}

useResizeObserver(root, check)
onMounted(check)
</script>

<template>
  <div ref="root" class="marquee" :class="{ 'is-overflowing': overflowing }">
    <div class="marquee-track">
      <span class="marquee-item"><slot /></span>
      <span v-if="overflowing" class="marquee-item" aria-hidden="true">
        <slot />
      </span>
    </div>
  </div>
</template>

<style scoped>
.marquee {
  overflow: hidden;
}

.marquee-track {
  display: inline-flex;
  white-space: nowrap;
  will-change: transform;
}

.is-overflowing .marquee-track {
  animation: marquee-scroll 10s linear 2s infinite;
}

.marquee:hover .marquee-track {
  animation-play-state: paused;
}

.marquee-item {
  padding-right: 1.5rem;
}

@keyframes marquee-scroll {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}
</style>
