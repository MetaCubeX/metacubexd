import { createContextProvider } from '@solid-primitives/context'
import * as i18n from '@solid-primitives/i18n'
import { makePersisted } from '@solid-primitives/storage'
import { LANG } from '~/constants'
import dict, { Dict } from './dict'

export const [locale, setLocale] = makePersisted(
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

export const [I18nProvider, useMaybeI18n] = createContextProvider<
  [i18n.Translator<Dict>],
  { locale: LANG }
>((props) => [
  i18n.translator(() => i18n.flatten(dict[props.locale]), i18n.resolveTemplate),
])

export const useI18n = () => useMaybeI18n()!

export { type Dict }
