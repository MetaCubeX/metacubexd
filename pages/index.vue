<script setup lang="ts">
import { IconArrowRight, IconRocket } from '@tabler/icons-vue'

const { t } = useI18n()

useHead({ title: computed(() => t('home')) })
const endpointStore = useEndpointStore()
const router = useRouter()

// Redirect to overview if already connected
onMounted(() => {
  if (endpointStore.currentEndpoint) {
    router.replace('/overview')
  }
})
</script>

<template>
  <div
    class="index-page-bg relative flex h-full items-center justify-center overflow-hidden p-4"
  >
    <!-- Animated background elements -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="index-bg-orb index-bg-orb-1"></div>
      <div class="index-bg-orb index-bg-orb-2"></div>
      <div class="index-bg-orb index-bg-orb-3"></div>
    </div>

    <div class="animate-fade-in relative z-10 text-center">
      <!-- Logo -->
      <div class="animate-scale-in mb-6">
        <h1 class="inline-block text-5xl font-black tracking-tight sm:text-6xl">
          <span class="index-title-gradient">Meta</span>
          <span class="index-title-gradient">Cube</span>
          <span class="index-title-xd relative ml-0.5 text-base-content"
            >XD</span
          >
        </h1>
      </div>

      <!-- Subtitle -->
      <p
        class="animate-fade-in-delayed mx-auto mb-10 max-w-md text-lg text-base-content/60"
      >
        Mihomo Dashboard, The Official One
      </p>

      <!-- Action buttons -->
      <div
        class="animate-fade-in-delayed-2 flex flex-col items-center justify-center gap-4 sm:flex-row"
      >
        <NuxtLink
          to="/setup"
          class="index-btn-primary group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-7 py-3.5 text-[0.9375rem] font-semibold no-underline transition-all duration-300 ease-out hover:-translate-y-0.5"
        >
          <IconRocket
            class="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-15"
            :size="20"
          />
          <span>{{ t('setup') }}</span>
          <IconArrowRight
            class="-translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
            :size="18"
          />
        </NuxtLink>

        <NuxtLink
          to="/overview"
          class="index-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-[0.9375rem] font-semibold no-underline backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5"
        >
          <span>{{ t('overview') }}</span>
        </NuxtLink>
      </div>

      <!-- Version badge -->
      <div
        class="animate-fade-in-delayed-3 mt-12 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-[0.8125rem] font-medium text-success"
      >
        <span class="h-2 w-2 animate-pulse rounded-full bg-success"></span>
        <span>Ready to connect</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Page background gradient */
.index-page-bg {
  background: linear-gradient(
    135deg,
    var(--color-base-100) 0%,
    var(--color-base-200) 50%,
    var(--color-base-300) 100%
  );
}

/* Background orbs - require custom positioning and complex gradients */
.index-bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: float 20s ease-in-out infinite;
}

.index-bg-orb-1 {
  top: -20%;
  left: -10%;
  width: 500px;
  height: 500px;
  background: linear-gradient(
    135deg,
    var(--color-primary) 0%,
    color-mix(in oklch, var(--color-primary) 50%, transparent) 100%
  );
}

.index-bg-orb-2 {
  bottom: -30%;
  right: -10%;
  width: 600px;
  height: 600px;
  background: linear-gradient(
    135deg,
    var(--color-secondary) 0%,
    color-mix(in oklch, var(--color-secondary) 50%, transparent) 100%
  );
  animation-delay: -7s;
}

.index-bg-orb-3 {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  height: 400px;
  background: linear-gradient(
    135deg,
    var(--color-accent) 0%,
    color-mix(in oklch, var(--color-accent) 30%, transparent) 100%
  );
  animation-delay: -14s;
  opacity: 0.2;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.05);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.95);
  }
}

/* Title gradient text */
.index-title-gradient {
  background: linear-gradient(
    135deg,
    var(--color-primary) 0%,
    var(--color-secondary) 50%,
    var(--color-accent) 100%
  );
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  background-size: 200% 200%;
  animation: gradientShift 8s ease-in-out infinite;
}

@keyframes gradientShift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

/* XD underline animation */
.index-title-xd::after {
  content: '';
  position: absolute;
  bottom: 0.1em;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--color-primary);
  border-radius: 2px;
  transform: scaleX(0);
  animation: underlineIn 0.6s ease-out 0.4s forwards;
}

@keyframes underlineIn {
  to {
    transform: scaleX(1);
  }
}

/* Primary button styles */
.index-btn-primary {
  background: linear-gradient(
    135deg,
    var(--color-primary) 0%,
    var(--color-secondary) 100%
  );
  color: var(--color-primary-content);
  box-shadow:
    0 4px 15px color-mix(in oklch, var(--color-primary) 40%, transparent),
    0 1px 3px rgba(0, 0, 0, 0.1);
}

.index-btn-primary:hover {
  box-shadow:
    0 8px 25px color-mix(in oklch, var(--color-primary) 50%, transparent),
    0 4px 10px rgba(0, 0, 0, 0.1);
}

.index-btn-primary::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    transparent 0%,
    rgba(255, 255, 255, 0.2) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.index-btn-primary:hover::before {
  opacity: 1;
}

/* Secondary button styles */
.index-btn-secondary {
  background: color-mix(in oklch, var(--color-base-content) 8%, transparent);
  color: var(--color-base-content);
  border: 1px solid
    color-mix(in oklch, var(--color-base-content) 15%, transparent);
}

.index-btn-secondary:hover {
  background: color-mix(in oklch, var(--color-base-content) 12%, transparent);
  border-color: color-mix(in oklch, var(--color-base-content) 25%, transparent);
}

/* Animations */
.animate-fade-in {
  animation: fadeIn 0.8s ease-out;
}

.animate-scale-in {
  animation: scaleIn 0.6s ease-out;
}

.animate-fade-in-delayed {
  animation: fadeIn 0.8s ease-out 0.2s backwards;
}

.animate-fade-in-delayed-2 {
  animation: fadeIn 0.8s ease-out 0.4s backwards;
}

.animate-fade-in-delayed-3 {
  animation: fadeIn 0.8s ease-out 0.6s backwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
