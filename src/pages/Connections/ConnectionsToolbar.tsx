import {
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-solidjs'
import type { Accessor, Setter } from 'solid-js'
import { uniq } from 'lodash'
import { twMerge } from 'tailwind-merge'
import { closeAllConnectionsAPI, closeSingleConnectionAPI } from '~/apis'
import { Button } from '~/components'
import { useI18n } from '~/i18n'
import type { Dict } from '~/i18n/dict'
import { allConnections, clientSourceIPTags } from '~/signals'
import type { Connection } from '~/types'
import type { Table } from '@tanstack/solid-table'

export enum ActiveTab {
  activeConnections,
  closedConnections,
}

interface TabInfo {
  type: ActiveTab
  name: string
  count: number
}

interface ConnectionsToolbarProps {
  // Tab controls
  tabs: () => TabInfo[]
  activeTab: Accessor<ActiveTab>
  setActiveTab: Setter<ActiveTab>
  // Quick filter
  enableQuickFilter: Accessor<boolean>
  setEnableQuickFilter: Setter<boolean>
  // Source IP filter
  setSourceIPFilter: Setter<string>
  // Sort controls
  sortColumn: Accessor<string>
  setSortColumn: Setter<string>
  sortDesc: Accessor<boolean>
  setSortDesc: Setter<boolean>
  setSorting: (sorting: { id: string; desc: boolean }[]) => void
  sortables: () => { id: string; key: keyof Dict }[]
  // Search
  setGlobalFilter: Setter<string>
  // Pause/Resume
  paused: Accessor<boolean>
  setPaused: Setter<boolean>
  // Table reference for close all
  table: Table<Connection>
  // Settings modal
  onOpenSettings: () => void
}

export const ConnectionsToolbar = (props: ConnectionsToolbarProps) => {
  const [t] = useI18n()
  const [isClosingConnections, setIsClosingConnections] = createSignal(false)

  const handleCloseConnections = async () => {
    setIsClosingConnections(true)

    if (props.table.getState().globalFilter) {
      await Promise.allSettled(
        props.table
          .getFilteredRowModel()
          .rows.map(({ original }) => closeSingleConnectionAPI(original.id)),
      )
    } else {
      await closeAllConnectionsAPI()
    }

    setIsClosingConnections(false)
  }

  return (
    <div class="flex w-full flex-col gap-2">
      {/* Row 1: Tabs + Quick filter + Source IP filter */}
      <div class="flex flex-wrap items-center gap-2">
        <div class="tabs-box tabs gap-2 tabs-sm">
          <Index each={props.tabs()}>
            {(tab) => (
              <button
                class={twMerge(
                  props.activeTab() === tab().type &&
                    'bg-primary text-neutral!',
                  'tab gap-2 px-2',
                )}
                onClick={() => props.setActiveTab(tab().type)}
              >
                <span>{tab().name}</span>
                <div class="badge badge-sm">{tab().count}</div>
              </button>
            )}
          </Index>
        </div>

        <div class="flex items-center gap-2">
          <span class="hidden text-sm sm:inline-block">{t('quickFilter')}</span>
          <input
            type="checkbox"
            class="toggle toggle-sm"
            checked={props.enableQuickFilter()}
            onChange={(e) => props.setEnableQuickFilter(e.target.checked)}
          />
        </div>

        <select
          class="select max-w-40 flex-1 select-sm select-primary"
          onChange={(e) => props.setSourceIPFilter(e.target.value)}
        >
          <option value="">{t('all')}</option>

          <Index
            each={uniq(
              allConnections().map(({ metadata: { sourceIP } }) => {
                const src = sourceIP || t('inner')
                const tagged = clientSourceIPTags().find(
                  (tag) => tag.sourceIP === src,
                )

                return tagged?.tagName || src
              }),
            ).sort()}
          >
            {(sourceIP) => <option value={sourceIP()}>{sourceIP()}</option>}
          </Index>
        </select>
      </div>

      {/* Row 2: Sort + Search + Actions */}
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex shrink-0 items-center gap-1">
          <span class="hidden text-sm whitespace-nowrap sm:inline-block">
            {t('sortBy')}
          </span>
          <select
            class="select select-sm select-primary"
            value={props.sortColumn()}
            onChange={(e) => {
              const id = e.target.value
              props.setSortColumn(id)
              props.setSorting([{ id, desc: props.sortDesc() }])
            }}
          >
            <Index each={props.sortables()}>
              {(opt) => <option value={opt().id}>{t(opt().key)}</option>}
            </Index>
          </select>
          <Button
            class="btn btn-sm btn-primary"
            onClick={() => {
              const next = !props.sortDesc()
              props.setSortDesc(next)
              props.setSorting([{ id: props.sortColumn(), desc: next }])
            }}
            icon={
              props.sortDesc() ? <IconSortDescending /> : <IconSortAscending />
            }
          />
        </div>

        <div class="join flex min-w-0 flex-1 items-center">
          <input
            type="search"
            class="input input-sm join-item min-w-0 flex-1 input-primary"
            placeholder={t('search')}
            onInput={(e) => props.setGlobalFilter(e.target.value)}
          />

          <Button
            class="btn join-item btn-sm btn-primary"
            onClick={() => props.setPaused((paused) => !paused)}
            icon={props.paused() ? <IconPlayerPlay /> : <IconPlayerPause />}
          />

          <Button
            class="btn join-item btn-sm btn-primary"
            onClick={handleCloseConnections}
            icon={
              isClosingConnections() ? (
                <div class="loading loading-spinner" />
              ) : (
                <IconX />
              )
            }
          />

          <Button
            class="btn join-item btn-sm btn-primary"
            onClick={props.onOpenSettings}
            icon={<IconSettings />}
          />
        </div>
      </div>
    </div>
  )
}
