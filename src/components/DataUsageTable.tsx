import {
  IconArrowDown,
  IconArrowUp,
  IconClock,
  IconInfoCircle,
  IconTrash,
} from '@tabler/icons-solidjs'
import byteSize from 'byte-size'
import { makePersisted } from '@solid-primitives/storage'
import { For, Show, createMemo, createSignal } from 'solid-js'
import { formatDateRange, formatDuration } from '~/helpers'
import { clearDataUsage, dataUsageMap, removeDataUsageEntry } from '~/signals'
import { DataUsageEntry } from '~/types'
import { useI18n } from '~/i18n'

type SortField = 'ip' | 'duration' | 'total'
type SortOrder = 'asc' | 'desc'

export const DataUsageTable = () => {
  const [t] = useI18n()
  const [sortField, setSortField] = createSignal<SortField>('total')
  const [sortOrder, setSortOrder] = createSignal<SortOrder>('desc')
  const [showTable, setShowTable] = makePersisted(createSignal(false), {
    name: 'showDataUsageTable',
    storage: localStorage,
  })

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
    if (confirm(t('confirmClearAll'))) {
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
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-base-content">
              {t('dataUsage')}
            </h2>
            <div
              class="tooltip tooltip-top before:ml-4 before:max-w-xs before:rounded-lg before:p-2 before:text-xs before:content-[attr(data-tip)] md:tooltip-right md:before:ml-0 md:before:text-sm lg:before:text-base"
              data-tip={t('dataUsageInfo')}
            >
              <button class="btn btn-circle text-info btn-ghost btn-xs">
                <IconInfoCircle size={18} />
              </button>
            </div>
            <input
              type="checkbox"
              class="toggle toggle-primary"
              checked={showTable()}
              onChange={(e) => setShowTable(e.currentTarget.checked)}
            />
          </div>
          <Show when={showTable()}>
            <button class="btn btn-sm btn-error" onClick={handleClearAll}>
              <IconTrash size={16} />
              <span class="hidden sm:inline">{t('clearAll')}</span>
            </button>
          </Show>
        </div>
        <Show when={showTable()}>
          <Show when={totalStats().count > 0}>
            <div class="stats stats-vertical bg-base-200 shadow sm:stats-horizontal">
              <div class="stat py-2">
                <div class="stat-title text-xs">{t('devices')}</div>
                <div class="stat-value text-lg text-primary">
                  {totalStats().count}
                </div>
              </div>
              <Show when={totalStats().firstSeen && totalStats().lastSeen}>
                <div class="stat py-2">
                  <div class="stat-title text-xs">{t('timeRange')}</div>
                  <div
                    class="stat-value text-sm"
                    title={formatDateRange(
                      totalStats().firstSeen!,
                      totalStats().lastSeen!,
                    )}
                  >
                    <div class="flex items-center gap-1">
                      <IconClock size={16} />
                      <span>
                        {formatDuration(
                          totalStats().firstSeen!,
                          totalStats().lastSeen!,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Show>
              <div class="stat py-2">
                <div class="stat-title text-xs">{t('uploadTotal')}</div>
                <div class="stat-value text-lg">
                  {byteSize(totalStats().upload).toString()}
                </div>
              </div>
              <div class="stat py-2">
                <div class="stat-title text-xs">{t('downloadTotal')}</div>
                <div class="stat-value text-lg">
                  {byteSize(totalStats().download).toString()}
                </div>
              </div>
              <div class="stat py-2">
                <div class="stat-title text-xs">{t('grandTotal')}</div>
                <div class="stat-value text-lg text-secondary">
                  {byteSize(totalStats().total).toString()}
                </div>
              </div>
            </div>
          </Show>

          {/* Desktop Table View */}
          <div class="hidden overflow-x-auto rounded-md lg:block">
            <table class="table w-full table-zebra">
              <thead>
                <tr class="bg-base-200">
                  <th class="text-base-content">{t('macAddress')}</th>
                  <th class="text-base-content">
                    <SortButton field="ip" label={t('ipAddress')} />
                  </th>
                  <th class="text-base-content">
                    <SortButton field="duration" label={t('duration')} />
                  </th>
                  <th class="text-base-content">{t('upload')}</th>
                  <th class="text-base-content">{t('download')}</th>
                  <th class="text-base-content">
                    <SortButton field="total" label={t('total')} />
                  </th>
                  <th class="text-base-content">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                <Show
                  when={dataUsageEntries().length > 0}
                  fallback={
                    <tr>
                      <td colSpan={7} class="text-center text-base-content/70">
                        {t('noDataUsageYet')}
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
                            {entry.macAddress || t('na')}
                          </td>
                          <td class="font-mono text-base-content">
                            {entry.sourceIP}
                          </td>
                          <td class="text-base-content" title={dateRange}>
                            <div class="flex items-center gap-1">
                              <IconClock
                                size={14}
                                class="text-base-content/60"
                              />
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
                              title={t('remove')}
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
                  {t('sortBy')}
                </div>
                <div class="flex flex-1 gap-2">
                  <button
                    class={`btn flex-1 btn-xs ${sortField() === 'ip' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => handleSort('ip')}
                  >
                    {t('ipShort')}
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
                    {t('duration')}
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
                    {t('total')}
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
                  {t('noDataUsageYet')}
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
                              {t('ipAddress')}
                            </div>
                            <div class="font-mono text-sm font-bold text-base-content">
                              {entry.sourceIP}
                            </div>
                          </div>
                          <button
                            class="btn btn-circle text-error btn-ghost btn-xs"
                            onClick={() => handleRemoveEntry(entry.sourceIP)}
                            title={t('remove')}
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>

                        <Show when={entry.macAddress}>
                          <div class="mb-2">
                            <div class="text-xs font-semibold text-base-content/60 uppercase">
                              {t('macAddress')}
                            </div>
                            <div class="text-sm text-base-content">
                              {entry.macAddress}
                            </div>
                          </div>
                        </Show>

                        <Show when={entry.firstSeen}>
                          <div class="mb-2">
                            <div class="text-xs font-semibold text-base-content/60 uppercase">
                              {t('timeRange')}
                            </div>
                            <div class="flex items-center gap-1 text-sm text-base-content">
                              <IconClock
                                size={14}
                                class="text-base-content/60"
                              />
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
                              {t('upload')}
                            </div>
                            <div class="text-sm font-medium text-base-content">
                              {byteSize(entry.upload).toString()}
                            </div>
                          </div>
                          <div>
                            <div class="text-xs font-semibold text-base-content/60 uppercase">
                              {t('download')}
                            </div>
                            <div class="text-sm font-medium text-base-content">
                              {byteSize(entry.download).toString()}
                            </div>
                          </div>
                          <div>
                            <div class="text-xs font-semibold text-base-content/60 uppercase">
                              {t('total')}
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
        </Show>
      </div>
    </div>
  )
}
