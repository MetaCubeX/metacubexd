<script setup lang="ts">
import type { Proxy as ProxyType } from '~/types'
import { IconChevronRight } from '@tabler/icons-vue'
import { formatProxyType, resolveActiveGroup } from '~/utils'

interface Props {
  groups: ProxyType[]
  sortedNamesByGroup: Record<string, string[]>
}

const props = defineProps<Props>()

const proxiesStore = useProxiesStore()
const { t } = useI18n()

const groupNames = computed(() => props.groups.map((g) => g.name))

const activeName = ref<string | null>(null)
// Keep active valid as the group list changes (e.g. on refetch).
watchEffect(() => {
  activeName.value = resolveActiveGroup(groupNames.value, activeName.value)
})

const activeGroup = computed(
  () => props.groups.find((g) => g.name === activeName.value) ?? null,
)
const activeNodes = computed(() =>
  activeGroup.value
    ? props.sortedNamesByGroup[activeGroup.value.name] || []
    : [],
)

function aliveCount(group: ProxyType) {
  return (
    group.all?.filter((n) => proxiesStore.proxyNodeMap[n]?.alive === true)
      .length ?? 0
  )
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 sm:flex-row">
    <!-- Group navigation: horizontal scroll strip on mobile, left rail on >=sm -->
    <div
      class="flex shrink-0 gap-1 overflow-x-auto pb-1 sm:w-48 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:pb-0"
    >
      <button
        v-for="group in groups"
        :key="group.name"
        type="button"
        class="flex w-36 shrink-0 flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 sm:w-auto sm:shrink"
        :class="
          group.name === activeName
            ? 'border-primary/55 bg-primary/12 text-base-content'
            : 'border-base-content/8 bg-base-200/60 text-base-content/70 hover:border-primary/30 hover:bg-primary/8'
        "
        @click="activeName = group.name"
      >
        <span class="flex items-center justify-between gap-2">
          <span class="truncate text-sm font-semibold">{{ group.name }}</span>
          <span class="shrink-0 text-[0.7rem] text-base-content/50">
            {{ aliveCount(group) }}/{{ group.all?.length ?? 0 }}
          </span>
        </span>
        <span class="hidden truncate text-xs text-base-content/45 sm:block">{{
          group.now
        }}</span>
      </button>
    </div>

    <!-- Right detail: active group's nodes -->
    <div
      v-if="activeGroup"
      class="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-base-content/8 bg-base-200/40 p-3"
    >
      <div class="flex items-center gap-2 px-1">
        <span class="text-lg font-semibold text-base-content">{{
          activeGroup.name
        }}</span>
        <span
          class="badge inline-flex items-center gap-1 badge-sm badge-primary"
        >
          <span class="font-bold">{{
            formatProxyType(activeGroup.type, t)
          }}</span>
          <template v-if="activeGroup.now?.length">
            <IconChevronRight :size="16" />
            <span class="whitespace-nowrap">{{ activeGroup.now }}</span>
          </template>
        </span>
      </div>

      <div class="flex flex-col gap-2">
        <ProxyNodeListItem
          v-for="name in activeNodes"
          :key="name"
          :proxy-name="name"
          :test-url="activeGroup.testUrl || null"
          :timeout="activeGroup.timeout ?? null"
          :is-selected="activeGroup.now === name"
          @click="proxiesStore.selectProxyInGroup(activeGroup, name)"
        />
      </div>
    </div>
  </div>
</template>
