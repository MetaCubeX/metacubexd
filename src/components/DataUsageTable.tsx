import {
  IconArrowDown,
  IconArrowUp,
  IconClock,
  IconTrash,
} from '@tabler/icons-solidjs'
import byteSize from 'byte-size'
import { For } from 'solid-js'
import { formatDateRange, formatDuration } from '~/helpers'
import { clearDataUsage, dataUsageMap, removeDataUsageEntry } from '~/signals'
import { DataUsageEntry } from '~/types'

type SortField = 'ip' | 'duration' | 'total'
type SortOrder = 'asc' | 'desc'

export const DataUsageTable = () => {
  const [sortField, setSortField] = createSignal<SortField>('total')
  const [sortOrder, setSortOrder] = createSignal<SortOrder>('desc')

  const handleSort = (field: SortField) => {
    if (sortField() === field) {
      // Toggle order if same field
      setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field with default desc order
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const dataUsageEntries = createMemo(() => {
    const entries = Object.values(dataUsageMap())
    const field = sortField()
    const order = sortOrder()

    return entries.sort((a, b) => {
      let comparison = 0

      switch (field) {
        case 'ip':
          comparison = a.sourceIP.localeCompare(b.sourceIP)
          break
        case 'duration': {
          const durationA = a.firstSeen ? a.lastSeen - a.firstSeen : 0
          const durationB = b.firstSeen ? b.lastSeen - b.firstSeen : 0

          comparison = durationA - durationB
          break
        }
        case 'total':
          comparison = a.total - b.total
          break
      }

      return order === 'asc' ? comparison : -comparison
    })
  })

  const totalStats = createMemo(() => {
    const entries = dataUsageEntries()
    const totalUpload = entries.reduce((sum, entry) => sum + entry.upload, 0)
    const totalDownload = entries.reduce(
      (sum, entry) => sum + entry.download,
      0,
    )

    // Calculate overall time range
    let earliestFirst = Number.MAX_SAFE_INTEGER
    let latestLast = 0

    entries.forEach((entry) => {
      if (entry.firstSeen && entry.firstSeen < earliestFirst) {
        earliestFirst = entry.firstSeen
      }

      if (entry.lastSeen && entry.lastSeen > latestLast) {
        latestLast = entry.lastSeen
      }
    })

    const hasTimeRange =
      earliestFirst !== Number.MAX_SAFE_INTEGER && latestLast > 0

    return {
      count: entries.length,
      upload: totalUpload,
      download: totalDownload,
      total: totalUpload + totalDownload,
      firstSeen: hasTimeRange ? earliestFirst : undefined,
      lastSeen: hasTimeRange ? latestLast : undefined,
    }
  })

  const handleClearAll = () => {
    if (confirm('Clear all data usage?')) {
      clearDataUsage()
    }
  }

  const handleRemoveEntry = (sourceIP: string) => {
    removeDataUsageEntry(sourceIP)
  }

  const SortButton = (props: { field: SortField; label: string }) => {
    const isActive = () => sortField() === props.field
    const currentOrder = () => (isActive() ? sortOrder() : null)

    return (
      <button
        class="flex items-center gap-1 hover:text-primary"
        onClick={() => handleSort(props.field)}
      >
        <span>{props.label}</span>
        <Show when={isActive()}>
          {currentOrder() === 'asc' ? (
            <IconArrowUp size={14} />
          ) : (
            <IconArrowDown size={14} />
          )}
        </Show>
      </button>
    )
  }

  return (
    <div class="rounded-box bg-base-300 p-4">
      <div class="mb-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-base-content">Data Usage</h2>
          <button class="btn btn-sm btn-error" onClick={handleClearAll}>
            <IconTrash size={16} />
            <span class="hidden sm:inline">Clear All</span>
          </button>
        </div>
        <Show when={totalStats().count > 0}>
          <div class="stats stats-vertical bg-base-200 shadow sm:stats-horizontal">
            <div class="stat py-2">
              <div class="stat-title text-xs">Devices</div>
              <div class="stat-value text-lg text-primary">
                {totalStats().count}
              </div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">Total Upload</div>
              <div class="stat-value text-lg">
                {byteSize(totalStats().upload).toString()}
              </div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">Total Download</div>
              <div class="stat-value text-lg">
                {byteSize(totalStats().download).toString()}
              </div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">Grand Total</div>
              <div class="stat-value text-lg text-secondary">
                {byteSize(totalStats().total).toString()}
              </div>
              <Show when={totalStats().firstSeen && totalStats().lastSeen}>
                <div
                  class="stat-desc mt-1 flex items-center gap-1"
                  title={formatDateRange(
                    totalStats().firstSeen!,
                    totalStats().lastSeen!,
                  )}
                >
                  <IconClock size={12} />
                  <span class="text-xs">
                    {formatDuration(
                      totalStats().firstSeen!,
                      totalStats().lastSeen!,
                    )}
                  </span>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Desktop Table View */}
      <div class="hidden overflow-x-auto rounded-md lg:block">
        <table class="table w-full table-zebra">
          <thead>
            <tr class="bg-base-200">
              <th class="text-base-content">MAC Address</th>
              <th class="text-base-content">
                <SortButton field="ip" label="IP Address" />
              </th>
              <th class="text-base-content">
                <SortButton field="duration" label="Duration" />
              </th>
              <th class="text-base-content">Upload</th>
              <th class="text-base-content">Download</th>
              <th class="text-base-content">
                <SortButton field="total" label="Total" />
              </th>
              <th class="text-base-content">Actions</th>
            </tr>
          </thead>
          <tbody>
            <Show
              when={dataUsageEntries().length > 0}
              fallback={
                <tr>
                  <td colSpan={7} class="text-center text-base-content/70">
                    No data usage recorded yet
                  </td>
                </tr>
              }
            >
              <For each={dataUsageEntries()}>
                {(entry: DataUsageEntry) => {
                  const duration = entry.firstSeen
                    ? formatDuration(entry.firstSeen, entry.lastSeen)
                    : '-'
                  const dateRange = entry.firstSeen
                    ? formatDateRange(entry.firstSeen, entry.lastSeen)
                    : '-'

                  return (
                    <tr class="hover">
                      <td class="text-base-content">
                        {entry.macAddress || 'N/A'}
                      </td>
                      <td class="font-mono text-base-content">
                        {entry.sourceIP}
                      </td>
                      <td class="text-base-content" title={dateRange}>
                        <div class="flex items-center gap-1">
                          <IconClock size={14} class="text-base-content/60" />
                          <span class="text-sm">{duration}</span>
                        </div>
                      </td>
                      <td class="text-base-content">
                        {byteSize(entry.upload).toString()}
                      </td>
                      <td class="text-base-content">
                        {byteSize(entry.download).toString()}
                      </td>
                      <td class="font-bold text-primary">
                        {byteSize(entry.total).toString()}
                      </td>
                      <td>
                        <button
                          class="btn text-error btn-ghost btn-xs hover:bg-error/20"
                          onClick={() => handleRemoveEntry(entry.sourceIP)}
                          title="Remove"
                        >
                          <IconTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                }}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div class="flex flex-col gap-3 lg:hidden">
        <Show when={dataUsageEntries().length > 0}>
          {/* Mobile Sort Buttons */}
          <div class="flex gap-2 rounded-lg bg-base-200 p-3">
            <div class="text-xs font-semibold text-base-content/60">
              Sort by:
            </div>
            <div class="flex flex-1 gap-2">
              <button
                class={`btn flex-1 btn-xs ${sortField() === 'ip' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSort('ip')}
              >
                IP
                <Show when={sortField() === 'ip'}>
                  {sortOrder() === 'asc' ? (
                    <IconArrowUp size={12} />
                  ) : (
                    <IconArrowDown size={12} />
                  )}
                </Show>
              </button>
              <button
                class={`btn flex-1 btn-xs ${sortField() === 'duration' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSort('duration')}
              >
                Duration
                <Show when={sortField() === 'duration'}>
                  {sortOrder() === 'asc' ? (
                    <IconArrowUp size={12} />
                  ) : (
                    <IconArrowDown size={12} />
                  )}
                </Show>
              </button>
              <button
                class={`btn flex-1 btn-xs ${sortField() === 'total' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSort('total')}
              >
                Total
                <Show when={sortField() === 'total'}>
                  {sortOrder() === 'asc' ? (
                    <IconArrowUp size={12} />
                  ) : (
                    <IconArrowDown size={12} />
                  )}
                </Show>
              </button>
            </div>
          </div>
        </Show>

        <Show
          when={dataUsageEntries().length > 0}
          fallback={
            <div class="rounded-lg bg-base-200 p-4 text-center text-base-content/70">
              No data usage recorded yet
            </div>
          }
        >
          <For each={dataUsageEntries()}>
            {(entry: DataUsageEntry) => {
              const duration = entry.firstSeen
                ? formatDuration(entry.firstSeen, entry.lastSeen)
                : '-'
              const dateRange = entry.firstSeen
                ? formatDateRange(entry.firstSeen, entry.lastSeen)
                : '-'

              return (
                <div class="card bg-base-200 shadow-md">
                  <div class="card-body p-4">
                    <div class="mb-2 flex items-start justify-between">
                      <div class="flex-1">
                        <div class="text-xs font-semibold text-base-content/60 uppercase">
                          IP Address
                        </div>
                        <div class="font-mono text-sm font-bold text-base-content">
                          {entry.sourceIP}
                        </div>
                      </div>
                      <button
                        class="btn btn-circle text-error btn-ghost btn-xs"
                        onClick={() => handleRemoveEntry(entry.sourceIP)}
                        title="Remove"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>

                    <Show when={entry.macAddress}>
                      <div class="mb-2">
                        <div class="text-xs font-semibold text-base-content/60 uppercase">
                          MAC Address
                        </div>
                        <div class="text-sm text-base-content">
                          {entry.macAddress}
                        </div>
                      </div>
                    </Show>

                    <Show when={entry.firstSeen}>
                      <div class="mb-2">
                        <div class="text-xs font-semibold text-base-content/60 uppercase">
                          Time Range
                        </div>
                        <div class="flex items-center gap-1 text-sm text-base-content">
                          <IconClock size={14} class="text-base-content/60" />
                          <span>{duration}</span>
                        </div>
                        <div class="text-xs text-base-content/60">
                          {dateRange}
                        </div>
                      </div>
                    </Show>

                    <div class="divider my-2" />

                    <div class="grid grid-cols-3 gap-2">
                      <div>
                        <div class="text-xs font-semibold text-base-content/60 uppercase">
                          Upload
                        </div>
                        <div class="text-sm font-medium text-base-content">
                          {byteSize(entry.upload).toString()}
                        </div>
                      </div>
                      <div>
                        <div class="text-xs font-semibold text-base-content/60 uppercase">
                          Download
                        </div>
                        <div class="text-sm font-medium text-base-content">
                          {byteSize(entry.download).toString()}
                        </div>
                      </div>
                      <div>
                        <div class="text-xs font-semibold text-base-content/60 uppercase">
                          Total
                        </div>
                        <div class="text-sm font-bold text-primary">
                          {byteSize(entry.total).toString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }}
          </For>
        </Show>
      </div>
    </div>
  )
}
