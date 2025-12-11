<script setup lang="ts">
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
  <div class="flex h-full items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold">MetaCubeXD</h1>
      <p class="mt-4 text-base-content/70">
        Mihomo Dashboard, The Official One
      </p>
      <div class="mt-8 flex justify-center gap-4">
        <NuxtLink to="/setup" class="btn btn-primary">
          {{ t('setup') }}
        </NuxtLink>
        <NuxtLink to="/overview" class="btn btn-outline">
          {{ t('overview') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
