<script setup lang="ts">
import type { Connection } from '~/types'
import { IconNetwork } from '@tabler/icons-vue'
import byteSize from 'byte-size'
import dayjs from 'dayjs'

defineProps<{
  connection: Connection | null
}>()

const modalRef = ref<{ open: () => void; close: () => void }>()

const { t } = useI18n()

defineExpose({
  open: () => modalRef.value?.open(),
  close: () => modalRef.value?.close(),
})
</script>

<template>
  <Modal ref="modalRef" :title="t('connectionsDetails')">
    <template #icon>
      <IconNetwork :size="24" />
    </template>

    <div
      v-if="connection"
      class="flex max-h-[70vh] flex-col gap-4 overflow-x-hidden overflow-y-auto"
    >
      <!-- Basic Info -->
      <div class="rounded-box bg-base-200 p-3">
        <div class="mb-2 font-semibold text-primary">{{ t('basic') }}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/70">ID</div>
          <div class="min-w-0 font-mono break-all">
            {{ connection.id }}
          </div>
          <div class="text-base-content/70">{{ t('start') }}</div>
          <div>{{ dayjs(connection.start).format('HH:mm:ss') }}</div>
          <div class="text-base-content/70">{{ t('rule') }}</div>
          <div>{{ connection.rule }}</div>
          <div class="text-base-content/70">{{ t('rulePayload') }}</div>
          <div class="break-all">
            {{ connection.rulePayload || '-' }}
          </div>
        </div>
      </div>

      <!-- Traffic -->
      <div class="rounded-box bg-base-200 p-3">
        <div class="mb-2 font-semibold text-primary">{{ t('traffic') }}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/70">{{ t('download') }}</div>
          <div>{{ byteSize(connection.download) }}</div>
          <div class="text-base-content/70">{{ t('upload') }}</div>
          <div>{{ byteSize(connection.upload) }}</div>
          <div class="text-base-content/70">{{ t('dlSpeed') }}</div>
          <div>{{ byteSize(connection.downloadSpeed) }}/s</div>
          <div class="text-base-content/70">{{ t('ulSpeed') }}</div>
          <div>{{ byteSize(connection.uploadSpeed) }}/s</div>
        </div>
      </div>

      <!-- Metadata -->
      <div class="rounded-box bg-base-200 p-3">
        <div class="mb-2 font-semibold text-primary">{{ t('metadata') }}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/70">{{ t('network') }}</div>
          <div>{{ connection.metadata.network }}</div>
          <div class="text-base-content/70">{{ t('type') }}</div>
          <div>{{ connection.metadata.type }}</div>
          <div class="text-base-content/70">{{ t('host') }}</div>
          <div class="break-all">
            {{ connection.metadata.host || '-' }}
          </div>
          <div class="text-base-content/70">{{ t('sniffHost') }}</div>
          <div class="break-all">
            {{ connection.metadata.sniffHost || '-' }}
          </div>
          <div class="text-base-content/70">{{ t('dnsMode') }}</div>
          <div>{{ connection.metadata.dnsMode || '-' }}</div>
        </div>
      </div>

      <!-- Source & Destination -->
      <div class="rounded-box bg-base-200 p-3">
        <div class="mb-2 font-semibold text-primary">
          {{ t('sourceAndDestination') }}
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/70">{{ t('source') }}</div>
          <div class="min-w-0 font-mono break-all">
            {{
              `${connection.metadata.sourceIP}:${connection.metadata.sourcePort}`
            }}
          </div>
          <div class="text-base-content/70">{{ t('destination') }}</div>
          <div class="min-w-0 font-mono break-all">
            {{
              connection.metadata.destinationIP
                ? `${connection.metadata.destinationIP}:${connection.metadata.destinationPort}`
                : `${connection.metadata.host}:${connection.metadata.destinationPort}`
            }}
          </div>
          <div class="text-base-content/70">{{ t('remoteDestination') }}</div>
          <div class="min-w-0 font-mono break-all">
            {{ connection.metadata.remoteDestination || '-' }}
          </div>
        </div>
      </div>

      <!-- Inbound -->
      <div class="rounded-box bg-base-200 p-3">
        <div class="mb-2 font-semibold text-primary">{{ t('inbound') }}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/70">{{ t('inboundName') }}</div>
          <div>{{ connection.metadata.inboundName || '-' }}</div>
          <div class="text-base-content/70">{{ t('inboundIP') }}</div>
          <div class="min-w-0 font-mono break-all">
            {{
              connection.metadata.inboundIP
                ? `${connection.metadata.inboundIP}:${connection.metadata.inboundPort}`
                : '-'
            }}
          </div>
          <div class="text-base-content/70">{{ t('inboundUser') }}</div>
          <div>{{ connection.metadata.inboundUser || '-' }}</div>
        </div>
      </div>

      <!-- Process -->
      <div class="rounded-box bg-base-200 p-3">
        <div class="mb-2 font-semibold text-primary">{{ t('process') }}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/70">{{ t('processName') }}</div>
          <div>{{ connection.metadata.process || '-' }}</div>
          <div class="text-base-content/70">{{ t('processPath') }}</div>
          <div class="min-w-0 text-xs break-all">
            {{ connection.metadata.processPath || '-' }}
          </div>
          <div class="text-base-content/70">UID</div>
          <div>{{ connection.metadata.uid || '-' }}</div>
        </div>
      </div>

      <!-- Chains -->
      <div class="rounded-box bg-base-200 p-3">
        <div class="mb-2 font-semibold text-primary">{{ t('chains') }}</div>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="(chain, index) in connection.chains"
            :key="index"
            class="badge badge-neutral"
          >
            {{ chain }}
          </span>
        </div>
      </div>

      <!-- Special -->
      <div
        v-if="
          connection.metadata.specialProxy || connection.metadata.specialRules
        "
        class="rounded-box bg-base-200 p-3"
      >
        <div class="mb-2 font-semibold text-primary">{{ t('special') }}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/70">{{ t('specialProxy') }}</div>
          <div>{{ connection.metadata.specialProxy || '-' }}</div>
          <div class="text-base-content/70">{{ t('specialRules') }}</div>
          <div>{{ connection.metadata.specialRules || '-' }}</div>
        </div>
      </div>
    </div>
  </Modal>
</template>
