import { useI18n } from '@solid-primitives/i18n'
import { For } from 'solid-js'
import { ConfigTitle } from '~/components'
import { MODAL, PROXIES_ORDERING_TYPE, PROXIES_PREVIEW_TYPE } from '~/constants'
import {
  autoCloseConns,
  latencyTestTimeoutDuration,
  proxiesOrderingType,
  proxiesPreviewType,
  setAutoCloseConns,
  setLatencyTestTimeoutDuration,
  setProxiesOrderingType,
  setProxiesPreviewType,
  setUrlForLatencyTest,
  urlForLatencyTest,
} from '~/signals'

export const ProxiesSettingsModal = () => {
  const [t] = useI18n()

  return (
    <dialog
      id={MODAL.PROXIES_SETTINGS}
      class="modal modal-bottom sm:modal-middle"
    >
      <div class="modal-box flex flex-col gap-4">
        <div>
          <ConfigTitle withDivider>{t('autoCloseConns')}</ConfigTitle>

          <div class="flex w-full justify-center">
            <input
              class="toggle"
              type="checkbox"
              checked={autoCloseConns()}
              onChange={(e) => setAutoCloseConns(e.target.checked)}
            />
          </div>
        </div>

        <div class="flex flex-col">
          <ConfigTitle withDivider>{t('urlForLatencyTest')}</ConfigTitle>

          <input
            class="input input-bordered w-full"
            value={urlForLatencyTest()}
            onChange={(e) => setUrlForLatencyTest(e.target.value)}
          />
        </div>

        <div>
          <ConfigTitle withDivider>
            {t('latencyTestTimeoutDuration')} ({t('ms')})
          </ConfigTitle>

          <input
            type="number"
            class="input input-bordered w-full"
            value={latencyTestTimeoutDuration()}
            onChange={(e) =>
              setLatencyTestTimeoutDuration(Number(e.target.value))
            }
          />
        </div>

        <div>
          <ConfigTitle withDivider>{t('proxiesSorting')}</ConfigTitle>

          <select
            class="select select-bordered w-full"
            value={proxiesOrderingType()}
            onChange={(e) =>
              setProxiesOrderingType(e.target.value as PROXIES_ORDERING_TYPE)
            }
          >
            <For each={Object.values(PROXIES_ORDERING_TYPE)}>
              {(value) => (
                <option class="flex items-center gap-2" value={value}>
                  {t(value)}
                </option>
              )}
            </For>
          </select>
        </div>

        <div>
          <ConfigTitle withDivider>{t('proxiesPreviewType')}</ConfigTitle>

          <select
            class="select select-bordered w-full"
            value={proxiesPreviewType()}
            onChange={(e) =>
              setProxiesPreviewType(e.target.value as PROXIES_PREVIEW_TYPE)
            }
          >
            <For each={Object.values(PROXIES_PREVIEW_TYPE)}>
              {(value) => <option value={value}>{t(value)}</option>}
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
