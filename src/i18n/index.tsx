import { I18nContext, createI18nContext } from '@solid-primitives/i18n'
import { ParentComponent } from 'solid-js'
import { useLanguage } from '~/signals'

const dict = {
  'en-US': {
    navs: {
      overview: 'Overview',
      proxies: 'Proxies',
      rules: 'Rules',
      connections: 'Connections',
      config: 'Config',
    },
  },
  'zh-Hans': {
    navs: {
      overview: '概览',
      proxies: '代理',
      rules: '规则',
      connections: '连接',
      config: '配置',
    },
  },
}

export const I18nProvider: ParentComponent = (props) => {
  const { lang } = useLanguage()
  const value = createI18nContext(dict, lang())

  return (
    <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
  )
}
