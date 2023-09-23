import { IconGlobe } from '@tabler/icons-solidjs'
import { Component, For } from 'solid-js'
import { ConfigTitle, Modal } from '~/components'
import { PROXIES_ORDERING_TYPE, PROXIES_PREVIEW_TYPE } from '~/constants'
import { useI18n } from '~/i18n'
import {
  autoCloseConns,
  hideUnAvailableProxies,
  latencyTestTimeoutDuration,
  proxiesOrderingType,
  proxiesPreviewType,
  setAutoCloseConns,
  setHideUnAvailableProxies,
  setLatencyTestTimeoutDuration,
  setProxiesOrderingType,
  setProxiesPreviewType,
  setUrlForLatencyTest,
  urlForLatencyTest,
} from '~/signals'

export const ProxiesSettingsModal: Component<{
  ref?: (el: HTMLDialogElement) => void
}> = (props) => {
  const [t] = useI18n()

  return (
    <Modal
      ref={(el) => props.ref?.(el)}
      icon={<IconGlobe size={24} />}
      title={t('proxiesSettings')}
    >
      <div class="flex flex-col gap-4">
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
          <ConfigTitle withDivider>{t('hideUnAvailableProxies')}</ConfigTitle>

          <div class="flex w-full justify-center">
            <input
              class="toggle"
              type="checkbox"
              checked={hideUnAvailableProxies()}
              onChange={(e) => setHideUnAvailableProxies(e.target.checked)}
            />
          </div>
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
    </Modal>
  )
}
