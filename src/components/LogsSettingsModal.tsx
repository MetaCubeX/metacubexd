import { IconX } from '@tabler/icons-solidjs'
import { For } from 'solid-js'
import { Button, ConfigTitle } from '~/components'
import {
  LOGS_TABLE_MAX_ROWS_LIST,
  LOG_LEVEL,
  MODAL,
  TAILWINDCSS_SIZE,
} from '~/constants'
import { useI18n } from '~/i18n'
import {
  logLevel,
  logMaxRows,
  logsTableSize,
  setLogLevel,
  setLogMaxRows,
  setLogsTableSize,
} from '~/signals'

export const LogsSettingsModal = () => {
  const modalID = MODAL.LOGS_SETTINGS
  const [t] = useI18n()

  return (
    <dialog id={modalID} class="modal modal-bottom sm:modal-middle">
      <div class="modal-box flex flex-col gap-4">
        <div class="sticky top-0 z-50 flex items-center justify-end">
          <Button
            class="btn-circle btn-sm"
            onClick={() => {
              const modal = document.querySelector(
                `#${modalID}`,
              ) as HTMLDialogElement | null

              modal?.close()
            }}
            icon={<IconX size={20} />}
          />
        </div>

        <div>
          <ConfigTitle withDivider>{t('tableSize')}</ConfigTitle>

          <select
            class="select select-bordered w-full"
            value={logsTableSize()}
            onChange={(e) =>
              setLogsTableSize(e.target.value as TAILWINDCSS_SIZE)
            }
          >
            <For each={Object.values(TAILWINDCSS_SIZE)}>
              {(value) => <option value={value}>{t(value)}</option>}
            </For>
          </select>
        </div>

        <div>
          <ConfigTitle withDivider>{t('logLevel')}</ConfigTitle>

          <select
            class="select select-bordered w-full"
            value={logLevel()}
            onChange={(e) => setLogLevel(e.target.value as LOG_LEVEL)}
          >
            <For
              each={[
                LOG_LEVEL.Info,
                LOG_LEVEL.Error,
                LOG_LEVEL.Warning,
                LOG_LEVEL.Debug,
                LOG_LEVEL.Silent,
              ]}
            >
              {(level) => <option value={level}>{t(level)}</option>}
            </For>
          </select>
        </div>

        <div>
          <ConfigTitle withDivider>{t('logMaxRows')}</ConfigTitle>

          <select
            class="select select-bordered w-full"
            value={logMaxRows()}
            onChange={(e) => setLogMaxRows(parseInt(e.target.value))}
          >
            <For each={LOGS_TABLE_MAX_ROWS_LIST}>
              {(rows) => <option value={rows}>{rows}</option>}
            </For>
          </select>
        </div>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button />
      </form>
    </dialog>
  )
}
