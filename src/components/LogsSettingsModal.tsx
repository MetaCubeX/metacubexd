import { IconFileStack } from '@tabler/icons-solidjs'
import type { Component } from 'solid-js'
import { ConfigTitle, Modal } from '~/components'
import {
  LOGS_TABLE_MAX_ROWS_LIST,
  LOG_LEVEL,
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

export const LogsSettingsModal: Component<{
  ref?: (el: HTMLDialogElement) => void
}> = (props) => {
  const [t] = useI18n()

  return (
    <Modal
      ref={(el) => props.ref?.(el)}
      icon={<IconFileStack size={24} />}
      title={t('logsSettings')}
    >
      <div class="flex flex-col gap-4">
        <div>
          <ConfigTitle withDivider>{t('tableSize')}</ConfigTitle>

          <select
            class="select w-full"
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
            class="select w-full"
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
            class="select w-full"
            value={logMaxRows()}
            onChange={(e) => setLogMaxRows(parseInt(e.target.value))}
          >
            <For each={LOGS_TABLE_MAX_ROWS_LIST}>
              {(rows) => <option value={rows}>{rows}</option>}
            </For>
          </select>
        </div>
      </div>
    </Modal>
  )
}
