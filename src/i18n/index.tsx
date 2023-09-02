import { I18nContext, createI18nContext, useI18n } from '@solid-primitives/i18n'
import { makePersisted } from '@solid-primitives/storage'
import { ParentComponent, createEffect, createSignal } from 'solid-js'
import { LANG } from '~/config/enum'
import dict from './dict'

const useLanguage = () => {
  const [lang, setLang] = makePersisted(
    createSignal(
      Reflect.has(dict, navigator.language) ? navigator.language : LANG.EN,
    ),
    {
      name: 'lang',
      storage: localStorage,
    },
  )

  return { lang, setLang }
}

const I18nUpdator: ParentComponent = (props) => {
  const { setLang } = useLanguage()
  const [_, { locale }] = useI18n()

  createEffect(() => {
    setLang(locale())
  })

  return props.children
}

export const I18nProvider: ParentComponent = (props) => {
  const { lang } = useLanguage()
  const value = createI18nContext(dict, lang())

  return (
    <I18nContext.Provider value={value}>
      <I18nUpdator>{props.children}</I18nUpdator>
    </I18nContext.Provider>
  )
}
