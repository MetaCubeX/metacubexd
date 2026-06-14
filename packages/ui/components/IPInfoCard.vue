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
  <div
    class="rounded-xl border p-4 shadow-sm"
    style="
      background: color-mix(in oklch, var(--color-base-200) 60%, transparent);
      border-color: color-mix(
        in oklch,
        var(--color-base-content) 10%,
        transparent
      );
      box-shadow: 0 2px 8px
        color-mix(in oklch, var(--color-base-content) 5%, transparent);
    "
  >
    <div class="mb-3.5 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg text-primary"
          style="
            background: color-mix(
              in oklch,
              var(--color-primary) 15%,
              transparent
            );
          "
        >
          <IconWorld :size="18" />
        </div>
        <h3 class="m-0 text-[0.9375rem] font-semibold text-base-content">
          {{ t('currentIP') }}
        </h3>
      </div>
      <div class="flex items-center gap-1.5">
        <select
          :value="currentProvider"
          class="cursor-pointer appearance-none rounded-md bg-base-100 py-1.5 pr-6 pl-2.5 text-xs text-base-content transition-all duration-200 focus:border-primary focus:outline-none"
          style="
            border: 1px solid
              color-mix(in oklch, var(--color-base-content) 10%, transparent);
            background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;);
            background-repeat: no-repeat;
            background-position: right 0.375rem center;
          "
          @change="handleProviderChange"
        >
          <option v-for="p in providers" :key="p.value" :value="p.value">
            {{ p.label }}
          </option>
        </select>
        <button
          class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-base-content/10 bg-transparent text-base-content/60 transition-all duration-200 hover:bg-base-300 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-50"
          :class="{ 'animate-spin': isLoading }"
          :disabled="isLoading"
          @click="fetchIP()"
        >
          <IconRefresh :size="16" />
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="flex justify-center py-6">
      <span
        class="h-6 w-6 animate-spin rounded-full border-2 border-base-content/10 border-t-primary"
      />
    </div>

    <div
      v-else-if="error"
      class="rounded-lg p-3 text-[0.8125rem] text-error"
      style="
        background: color-mix(in oklch, var(--color-error) 10%, transparent);
        border: 1px solid
          color-mix(in oklch, var(--color-error) 20%, transparent);
      "
    >
      <span>{{ error }}</span>
    </div>

    <div v-else-if="ipInfo" class="flex flex-col gap-2.5">
      <div
        class="-mx-1 -mt-1 mb-1 flex items-center justify-between gap-3 rounded-lg px-2.5 py-2"
        style="
          background: color-mix(in oklch, var(--color-primary) 8%, transparent);
          border: 1px solid
            color-mix(in oklch, var(--color-primary) 15%, transparent);
        "
      >
        <span class="shrink-0 text-[0.8125rem] text-base-content/60">
          {{ t('ipAddress') }}
        </span>
        <span
          class="overflow-hidden text-right font-mono text-[0.8125rem] font-semibold text-ellipsis whitespace-nowrap text-primary"
          :title="ipInfo.ip"
        >
          {{ ipInfo.ip }}
        </span>
      </div>

      <div
        v-if="ipInfo.country"
        class="flex items-center justify-between gap-3"
      >
        <span class="shrink-0 text-[0.8125rem] text-base-content/60">
          {{ t('country') }}
        </span>
        <span
          class="overflow-hidden text-right text-[0.8125rem] font-medium text-ellipsis whitespace-nowrap text-base-content"
        >
          {{ ipInfo.country }}
        </span>
      </div>

      <div v-if="ipInfo.city" class="flex items-center justify-between gap-3">
        <span class="shrink-0 text-[0.8125rem] text-base-content/60">
          {{ t('city') }}
        </span>
        <span
          class="overflow-hidden text-right text-[0.8125rem] font-medium text-ellipsis whitespace-nowrap text-base-content"
        >
          {{ ipInfo.city }}
        </span>
      </div>

      <div v-if="ipInfo.org" class="flex items-center justify-between gap-3">
        <span class="shrink-0 text-[0.8125rem] text-base-content/60">
          {{ t('organization') }}
        </span>
        <span
          class="overflow-hidden text-right text-[0.8125rem] font-medium text-ellipsis whitespace-nowrap text-base-content"
          :title="ipInfo.org"
        >
          {{ ipInfo.org }}
        </span>
      </div>

      <div v-if="ipInfo.asn" class="flex items-center justify-between gap-3">
        <span class="shrink-0 text-[0.8125rem] text-base-content/60">
          ASN
        </span>
        <span
          class="overflow-hidden text-right font-mono text-[0.8125rem] font-semibold text-ellipsis whitespace-nowrap text-base-content"
        >
          AS{{ ipInfo.asn }}
        </span>
      </div>

      <div v-if="ipInfo.isp" class="flex items-center justify-between gap-3">
        <span class="shrink-0 text-[0.8125rem] text-base-content/60">
          ISP
        </span>
        <span
          class="overflow-hidden text-right text-[0.8125rem] font-medium text-ellipsis whitespace-nowrap text-base-content"
          :title="ipInfo.isp"
        >
          {{ ipInfo.isp }}
        </span>
      </div>

      <div
        v-if="ipInfo.isProxy !== undefined || ipInfo.isVPN !== undefined"
        class="flex items-center justify-between gap-3"
      >
        <span class="shrink-0 text-[0.8125rem] text-base-content/60">
          {{ t('proxyDetection') }}
        </span>
        <div class="flex gap-1">
          <span
            v-if="ipInfo.isProxy"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-warning uppercase"
            style="
              background: color-mix(
                in oklch,
                var(--color-warning) 15%,
                transparent
              );
            "
          >
            Proxy
          </span>
          <span
            v-if="ipInfo.isVPN"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-warning uppercase"
            style="
              background: color-mix(
                in oklch,
                var(--color-warning) 15%,
                transparent
              );
            "
          >
            VPN
          </span>
          <span
            v-if="!ipInfo.isProxy && !ipInfo.isVPN"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-success uppercase"
            style="
              background: color-mix(
                in oklch,
                var(--color-success) 15%,
                transparent
              );
            "
          >
            {{ t('clean') }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="py-6 text-center text-sm text-base-content/50">
      {{ t('noData') }}
    </div>
  </div>
</template>
