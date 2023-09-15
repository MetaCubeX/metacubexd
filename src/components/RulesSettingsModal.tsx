import { useI18n } from '@solid-primitives/i18n'
import { ConfigTitle } from '~/components'
import { MODAL } from '~/constants'
import { rulesRenderInTwoColumns, setRulesRenderInTwoColumns } from '~/signals'

export const RulesSettingsModal = () => {
  const [t] = useI18n()

  return (
    <dialog
      id={MODAL.RULES_SETTINGS}
      class="modal modal-bottom sm:modal-middle"
    >
      <div class="modal-box flex flex-col gap-4">
        <div>
          <ConfigTitle withDivider>{t('renderInTwoColumns')}</ConfigTitle>

          <div class="flex w-full justify-center">
            <input
              type="checkbox"
              class="toggle"
              checked={rulesRenderInTwoColumns()}
              onChange={(e) => setRulesRenderInTwoColumns(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button />
      </form>
    </dialog>
  )
}
