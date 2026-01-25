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
      <div class="rounded-lg border border-base-content/8 bg-base-200/80 p-3">
        <div class="mb-2 text-sm font-semibold text-primary">
          {{ t('basic') }}
        </div>
        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/60">ID</div>
          <div class="min-w-0 font-mono break-all text-base-content">
            {{ connection.id }}
          </div>
          <div class="text-base-content/60">{{ t('start') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ dayjs(connection.start).format('HH:mm:ss') }}
          </div>
          <div class="text-base-content/60">{{ t('rule') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.rule }}
          </div>
          <div class="text-base-content/60">{{ t('rulePayload') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.rulePayload || '-' }}
          </div>
        </div>
      </div>

      <!-- Traffic -->
      <div class="rounded-lg border border-base-content/8 bg-base-200/80 p-3">
        <div class="mb-2 text-sm font-semibold text-primary">
          {{ t('traffic') }}
        </div>
        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/60">{{ t('download') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ byteSize(connection.download) }}
          </div>
          <div class="text-base-content/60">{{ t('upload') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ byteSize(connection.upload) }}
          </div>
          <div class="text-base-content/60">{{ t('dlSpeed') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ byteSize(connection.downloadSpeed) }}/s
          </div>
          <div class="text-base-content/60">{{ t('ulSpeed') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ byteSize(connection.uploadSpeed) }}/s
          </div>
        </div>
      </div>

      <!-- Metadata -->
      <div class="rounded-lg border border-base-content/8 bg-base-200/80 p-3">
        <div class="mb-2 text-sm font-semibold text-primary">
          {{ t('metadata') }}
        </div>
        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/60">{{ t('network') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.network }}
          </div>
          <div class="text-base-content/60">{{ t('type') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.type }}
          </div>
          <div class="text-base-content/60">{{ t('host') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.host || '-' }}
          </div>
          <div class="text-base-content/60">{{ t('sniffHost') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.sniffHost || '-' }}
          </div>
          <div class="text-base-content/60">{{ t('dnsMode') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.dnsMode || '-' }}
          </div>
        </div>
      </div>

      <!-- Source & Destination -->
      <div class="rounded-lg border border-base-content/8 bg-base-200/80 p-3">
        <div class="mb-2 text-sm font-semibold text-primary">
          {{ t('sourceAndDestination') }}
        </div>
        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/60">{{ t('source') }}</div>
          <div class="min-w-0 font-mono break-all text-base-content">
            {{
              `${connection.metadata.sourceIP}:${connection.metadata.sourcePort}`
            }}
          </div>
          <div class="text-base-content/60">{{ t('destination') }}</div>
          <div class="min-w-0 font-mono break-all text-base-content">
            {{
              connection.metadata.destinationIP
                ? `${connection.metadata.destinationIP}:${connection.metadata.destinationPort}`
                : `${connection.metadata.host}:${connection.metadata.destinationPort}`
            }}
          </div>
          <div class="text-base-content/60">{{ t('remoteDestination') }}</div>
          <div class="min-w-0 font-mono break-all text-base-content">
            {{ connection.metadata.remoteDestination || '-' }}
          </div>
        </div>
      </div>

      <!-- Inbound -->
      <div class="rounded-lg border border-base-content/8 bg-base-200/80 p-3">
        <div class="mb-2 text-sm font-semibold text-primary">
          {{ t('inbound') }}
        </div>
        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/60">{{ t('inboundName') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.inboundName || '-' }}
          </div>
          <div class="text-base-content/60">{{ t('inboundIP') }}</div>
          <div class="min-w-0 font-mono break-all text-base-content">
            {{
              connection.metadata.inboundIP
                ? `${connection.metadata.inboundIP}:${connection.metadata.inboundPort}`
                : '-'
            }}
          </div>
          <div class="text-base-content/60">{{ t('inboundUser') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.inboundUser || '-' }}
          </div>
        </div>
      </div>

      <!-- Process -->
      <div class="rounded-lg border border-base-content/8 bg-base-200/80 p-3">
        <div class="mb-2 text-sm font-semibold text-primary">
          {{ t('process') }}
        </div>
        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/60">{{ t('processName') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.process || '-' }}
          </div>
          <div class="text-base-content/60">{{ t('processPath') }}</div>
          <div class="min-w-0 text-xs break-all text-base-content">
            {{ connection.metadata.processPath || '-' }}
          </div>
          <div class="text-base-content/60">UID</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.uid || '-' }}
          </div>
        </div>
      </div>

      <!-- Chains -->
      <div class="rounded-lg border border-base-content/8 bg-base-200/80 p-3">
        <div class="mb-2 text-sm font-semibold text-primary">
          {{ t('chains') }}
        </div>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="(chain, index) in connection.chains"
            :key="index"
            class="inline-flex items-center rounded-md bg-neutral px-2 py-1 text-xs font-medium text-neutral-content"
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
        class="rounded-lg border border-base-content/8 bg-base-200/80 p-3"
      >
        <div class="mb-2 text-sm font-semibold text-primary">
          {{ t('special') }}
        </div>
        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <div class="text-base-content/60">{{ t('specialProxy') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.specialProxy || '-' }}
          </div>
          <div class="text-base-content/60">{{ t('specialRules') }}</div>
          <div class="min-w-0 break-all text-base-content">
            {{ connection.metadata.specialRules || '-' }}
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>
