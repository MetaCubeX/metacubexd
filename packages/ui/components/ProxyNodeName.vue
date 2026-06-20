<script setup lang="ts">
import { splitLeadingFlag } from '~/utils'

const props = defineProps<{ name: string }>()
const parts = computed(() => splitLeadingFlag(props.name))
</script>

<template>
  <span v-if="parts.flag" class="mr-1.5">{{ parts.flag }}</span
  >{{ parts.rest }}
</template>
