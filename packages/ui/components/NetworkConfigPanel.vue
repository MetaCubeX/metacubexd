<!-- packages/ui/components/NetworkConfigPanel.vue -->
<script setup lang="ts">
import {
  IconNetwork,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-vue'

const { t } = useI18n()
const nc = useNetworkConfig()
const {
  available,
  loading,
  saving,
  load,
  tunnels,
  addTunnel,
  removeTunnel,
  saveTunnels,
  sniffer,
  saveSniffer,
  interfaceName,
  saveInterfaceName,
  externalController,
  secret,
} = nc

// Load the active profile's network sections once the panel mounts (only when
// the feature is present — the whole card is v-if'd off otherwise).
onMounted(() => {
  if (available.value) load()
})

// tunnels rows are edited by index — these helpers keep the array reactive
// while letting the inputs use a single-field @input.
function setTunnelField(
  index: number,
  field: 'address' | 'target',
  value: string,
) {
  const current = tunnels.value[index]
  if (!current) return
  tunnels.value = tunnels.value.map((row, i) =>
    i === index ? { ...current, [field]: value } : row,
  )
}

// mihomo `network` is a list (tcp/udp). The row editor exposes the common
// tcp/udp/both choices as a single select for simplicity.
const NETWORK_OPTIONS = [
  { label: 'tcp', value: ['tcp'] },
  { label: 'udp', value: ['udp'] },
  { label: 'tcp/udp', value: ['tcp', 'udp'] },
] as const

function networkValueOf(network: string[]): string {
  return [...network].sort().join(',')
}

function setTunnelNetwork(index: number, optionValue: string) {
  const current = tunnels.value[index]
  if (!current) return
  const option = NETWORK_OPTIONS.find(
    (o) => networkValueOf([...o.value]) === optionValue,
  )
  if (!option) return
  tunnels.value = tunnels.value.map((row, i) =>
    i === index ? { ...current, network: [...option.value] } : row,
  )
}
</script>

<template>
  <div
    v-if="available"
    class="rounded-xl border border-base-content/10 bg-base-200 p-4"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="flex items-center gap-2 font-semibold text-base-content">
        <IconNetwork :size="18" />
        {{ t('networkConfig') }}
      </span>
      <Button
        class="btn-outline btn-sm btn-secondary"
        :loading="loading"
        @click="load()"
      >
        <IconRefresh :size="16" />
        {{ t('refresh') }}
      </Button>
    </div>

    <p class="mb-4 text-sm text-base-content/60">
      {{ t('networkConfigHint') }}
    </p>

    <!-- Outbound interface-name (string editor; hot-applies via the kernel) -->
    <div class="mb-4 flex flex-col gap-2">
      <span class="text-sm font-medium text-base-content">
        {{ t('outboundInterfaceName') }}
      </span>
      <div class="flex items-center gap-2">
        <input
          v-model="interfaceName"
          type="text"
          class="input-bordered input input-sm w-full max-w-xs"
          placeholder="eth0"
        />
        <Button
          class="btn-sm btn-primary"
          :loading="saving"
          @click="saveInterfaceName()"
        >
          {{ t('save') }}
        </Button>
      </div>
    </div>

    <!-- Sniffer (object editor: enable + override-destination toggles) -->
    <div class="mb-4 flex flex-col gap-2 border-t border-base-content/10 pt-4">
      <span class="text-sm font-medium text-base-content">
        {{ t('sniffer') }}
      </span>
      <label class="flex items-center justify-between gap-4">
        <span class="text-sm">{{ t('snifferEnable') }}</span>
        <input
          v-model="sniffer.enable"
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
        />
      </label>
      <label class="flex items-center justify-between gap-4">
        <span class="text-sm">{{ t('snifferOverrideDestination') }}</span>
        <input
          v-model="sniffer.overrideDestination"
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
        />
      </label>
      <Button
        class="mt-1 w-fit btn-sm btn-primary"
        :loading="saving"
        @click="saveSniffer()"
      >
        {{ t('save') }}
      </Button>
    </div>

    <!-- Tunnels (array editor: add/remove rows) -->
    <div class="mb-4 flex flex-col gap-2 border-t border-base-content/10 pt-4">
      <span class="text-sm font-medium text-base-content">
        {{ t('tunnels') }}
      </span>
      <p class="text-xs text-base-content/50">{{ t('tunnelsHint') }}</p>

      <div
        v-for="(tunnel, index) in tunnels"
        :key="index"
        class="grid grid-cols-[7rem_1fr_1fr_auto] items-center gap-2 rounded-lg border border-base-content/8 bg-base-300/40 p-2"
      >
        <select
          class="select-bordered select select-sm"
          :value="networkValueOf(tunnel.network)"
          @change="
            setTunnelNetwork(index, ($event.target as HTMLSelectElement).value)
          "
        >
          <option
            v-for="opt in NETWORK_OPTIONS"
            :key="opt.label"
            :value="networkValueOf([...opt.value])"
          >
            {{ opt.label }}
          </option>
        </select>
        <input
          :value="tunnel.address"
          type="text"
          class="input-bordered input input-sm w-full text-xs"
          :placeholder="t('tunnelAddress')"
          @input="
            setTunnelField(
              index,
              'address',
              ($event.target as HTMLInputElement).value,
            )
          "
        />
        <input
          :value="tunnel.target"
          type="text"
          class="input-bordered input input-sm w-full text-xs"
          :placeholder="t('tunnelTarget')"
          @input="
            setTunnelField(
              index,
              'target',
              ($event.target as HTMLInputElement).value,
            )
          "
        />
        <Button
          class="flex h-7 w-7 items-center justify-center rounded-md text-base-content/50 transition-colors hover:bg-error/15 hover:text-error"
          :title="t('delete')"
          @click="removeTunnel(index)"
        >
          <IconTrash :size="16" />
        </Button>
      </div>

      <div
        v-if="tunnels.length === 0"
        class="py-4 text-center text-sm text-base-content/40"
      >
        {{ t('noTunnels') }}
      </div>

      <div class="flex items-center gap-2">
        <Button
          class="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/30 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10"
          @click="addTunnel()"
        >
          <IconPlus :size="16" />
          {{ t('add') }}
        </Button>
        <Button
          class="btn-sm btn-primary"
          :loading="saving"
          @click="saveTunnels()"
        >
          {{ t('save') }}
        </Button>
      </div>
    </div>

    <!-- external-controller / secret (read-only — app-managed on desktop) -->
    <div class="flex flex-col gap-2 border-t border-base-content/10 pt-4">
      <span class="text-sm font-medium text-base-content">
        {{ t('externalController') }}
      </span>
      <p class="text-xs text-base-content/50">
        {{ t('externalControllerManaged') }}
      </p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-base-content/60">
            {{ t('externalController') }}
          </span>
          <input
            :value="externalController"
            type="text"
            readonly
            class="input-bordered input input-sm w-full bg-base-300/40 font-mono text-xs"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-base-content/60">{{ t('secret') }}</span>
          <input
            :value="secret"
            type="text"
            readonly
            class="input-bordered input input-sm w-full bg-base-300/40 font-mono text-xs"
          />
        </label>
      </div>
    </div>
  </div>
</template>
