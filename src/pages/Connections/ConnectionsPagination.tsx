import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '@tabler/icons-solidjs'
import type { Table } from '@tanstack/solid-table'
import { twMerge } from 'tailwind-merge'
import type { Connection } from '~/types'

interface PaginationButtonsProps {
  table: Table<Connection>
  visiblePages: () => number[]
}

// Pagination buttons component (shared between mobile and desktop)
const PaginationButtons = (props: PaginationButtonsProps) => {
  return (
    <div class="join shrink-0">
      <button
        class="btn join-item btn-xs"
        onClick={() => props.table.setPageIndex(0)}
        disabled={!props.table.getCanPreviousPage()}
      >
        <IconChevronsLeft size={14} />
      </button>
      <button
        class="btn join-item btn-xs"
        onClick={() => props.table.previousPage()}
        disabled={!props.table.getCanPreviousPage()}
      >
        <IconChevronLeft size={14} />
      </button>

      <For each={props.visiblePages()}>
        {(page, index) => (
          <>
            <Show
              when={index() > 0 && page - props.visiblePages()[index() - 1] > 1}
            >
              <span class="flex items-center px-1 text-xs text-base-content/40">
                ···
              </span>
            </Show>
            <button
              class={twMerge(
                'btn join-item min-w-8 btn-xs',
                props.table.getState().pagination.pageIndex === page &&
                  'btn-active',
              )}
              onClick={() => props.table.setPageIndex(page)}
            >
              {page + 1}
            </button>
          </>
        )}
      </For>

      <button
        class="btn join-item btn-xs"
        onClick={() => props.table.nextPage()}
        disabled={!props.table.getCanNextPage()}
      >
        <IconChevronRight size={14} />
      </button>
      <button
        class="btn join-item btn-xs"
        onClick={() => props.table.setPageIndex(props.table.getPageCount() - 1)}
        disabled={!props.table.getCanNextPage()}
      >
        <IconChevronsRight size={14} />
      </button>
    </div>
  )
}

interface MobilePaginationProps {
  table: Table<Connection>
  visiblePages: () => number[]
}

// Mobile pagination - displayed at top
export const MobilePagination = (props: MobilePaginationProps) => {
  return (
    <div class="flex shrink-0 items-center justify-center md:hidden">
      <PaginationButtons
        table={props.table}
        visiblePages={props.visiblePages}
      />
    </div>
  )
}

interface DesktopPaginationProps {
  table: Table<Connection>
  visiblePages: () => number[]
  pageSize: () => number
  setPageSize: (size: number) => void
}

// Desktop pagination - displayed at bottom with page size selector
export const DesktopPagination = (props: DesktopPaginationProps) => {
  return (
    <div class="hidden shrink-0 items-center justify-between gap-2 md:flex">
      <div class="flex shrink-0 items-center gap-1.5">
        <select
          class="select-bordered select select-xs"
          value={props.pageSize()}
          onChange={(e) => props.setPageSize(Number(e.target.value))}
        >
          <For each={[20, 50, 100, 200]}>
            {(size) => <option value={size}>{size}</option>}
          </For>
        </select>
        <span class="text-xs whitespace-nowrap text-base-content/60">
          {props.table.getState().pagination.pageIndex *
            props.table.getState().pagination.pageSize +
            1}
          -
          {Math.min(
            (props.table.getState().pagination.pageIndex + 1) *
              props.table.getState().pagination.pageSize,
            props.table.getFilteredRowModel().rows.length,
          )}
          <span class="text-base-content/40">
            {' '}
            / {props.table.getFilteredRowModel().rows.length}
          </span>
        </span>
      </div>

      <PaginationButtons
        table={props.table}
        visiblePages={props.visiblePages}
      />
    </div>
  )
}
