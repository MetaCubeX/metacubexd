import * as i18n from '@solid-primitives/i18n'
import { makePersisted } from '@solid-primitives/storage'
import { createMemo, createSignal } from 'solid-js'
import { LANG } from '~/constants'
import dict from './dict'

const [curLocale, setCurLocale] = makePersisted(
  createSignal<LANG>(
    Reflect.has(dict, navigator.language)
      ? (navigator.language as LANG)
      : LANG.EN,
  ),
  {
    name: 'lang',
    storage: localStorage,
  },
)

const locale = (localeName?: LANG) => {
  if (localeName) {
    return setCurLocale(localeName)
  }

  return curLocale()
}

export const useI18n = () => {
  const curDict = createMemo(() => i18n.flatten(dict[curLocale()]))!
  const t = i18n.translator(() => curDict())

  return { t, locale }
}
