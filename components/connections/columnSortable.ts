import type { UseSortableOptions } from '@vueuse/integrations/useSortable'

export function createConnectionsColumnSortableOptions(): UseSortableOptions {
  return {
    handle: '.drag-handle',
    animation: 150,
    watchElement: true,
  }
}
