<script setup lang="ts">
import type { IPProvider } from '~/types/network'

import { IconRefresh, IconWorld } from '@tabler/icons-vue'
import { useIPInfo } from '~/composables/useIPInfo'

const { t } = useI18n()

const { currentProvider, ipInfo, isLoading, error, fetchIP } = useIPInfo()

const providers: { value: IPProvider; label: string }[] = [
  { value: 'ip.sb', label: 'IP.SB' },
  { value: 'ipwho.is', label: 'ipwho.is' },
  { value: 'ipapi.is', label: 'ipapi.is' },
]

// Fetch IP info on mount
onMounted(() => {
  fetchIP()
})

function handleProviderChange(event: Event) {
  const target = event.target as HTMLSelectElement
  fetchIP(target.value as IPProvider)
}
</script>

<template>
  <div class="card bg-base-200 p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <IconWorld class="h-5 w-5 text-primary" />
        <h3 class="font-semibold">{{ t('currentIP') }}</h3>
      </div>
      <div class="flex items-center gap-2">
        <select
          :value="currentProvider"
          class="select-bordered select select-sm"
          @change="handleProviderChange"
        >
          <option v-for="p in providers" :key="p.value" :value="p.value">
            {{ p.label }}
          </option>
        </select>
        <button
          class="btn btn-circle btn-ghost btn-sm"
          :class="{ 'animate-spin': isLoading }"
          :disabled="isLoading"
          @click="fetchIP()"
        >
          <IconRefresh class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="flex justify-center py-4">
      <span class="loading loading-md loading-spinner"></span>
    </div>

    <div v-else-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <div v-else-if="ipInfo" class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-base-content/60">{{ t('ipAddress') }}</span>
        <span class="truncate font-mono font-semibold" :title="ipInfo.ip">{{
          ipInfo.ip
        }}</span>
      </div>

      <div
        v-if="ipInfo.country"
        class="flex items-center justify-between gap-2"
      >
        <span class="shrink-0 text-base-content/60">{{ t('country') }}</span>
        <span class="truncate">{{ ipInfo.country }}</span>
      </div>

      <div v-if="ipInfo.city" class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-base-content/60">{{ t('city') }}</span>
        <span class="truncate">{{ ipInfo.city }}</span>
      </div>

      <div v-if="ipInfo.org" class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-base-content/60">{{
          t('organization')
        }}</span>
        <span class="truncate text-right" :title="ipInfo.org">
          {{ ipInfo.org }}
        </span>
      </div>

      <div v-if="ipInfo.asn" class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-base-content/60">ASN</span>
        <span class="truncate font-mono">AS{{ ipInfo.asn }}</span>
      </div>

      <div v-if="ipInfo.isp" class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-base-content/60">ISP</span>
        <span class="truncate text-right" :title="ipInfo.isp">
          {{ ipInfo.isp }}
        </span>
      </div>

      <div
        v-if="ipInfo.isProxy !== undefined || ipInfo.isVPN !== undefined"
        class="flex items-center justify-between"
      >
        <span class="text-base-content/60">{{ t('proxyDetection') }}</span>
        <div class="flex gap-1">
          <span v-if="ipInfo.isProxy" class="badge badge-sm badge-warning">
            Proxy
          </span>
          <span v-if="ipInfo.isVPN" class="badge badge-sm badge-warning">
            VPN
          </span>
          <span
            v-if="!ipInfo.isProxy && !ipInfo.isVPN"
            class="badge badge-sm badge-success"
          >
            {{ t('clean') }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="py-4 text-center text-base-content/60">
      {{ t('noData') }}
    </div>
  </div>
</template>
