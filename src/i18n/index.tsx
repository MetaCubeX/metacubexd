import { I18nContext, createI18nContext, useI18n } from '@solid-primitives/i18n'
import { makePersisted } from '@solid-primitives/storage'
import { ParentComponent, createEffect, createSignal } from 'solid-js'

const dict = {
  'en-US': {
    navs: {
      overview: 'Overview',
      proxies: 'Proxies',
      rules: 'Rules',
      connections: 'Connections',
      logs: 'Logs',
      config: 'Config',
    },
    stats: {
      upload: 'Upload',
      download: 'Download',
      uploadTotal: 'Upload Total',
      downloadTotal: 'Download Total',
      activeConnections: 'Active Connections',
      memoryUsage: 'Memory Usage',
    },
  },
  'zh-Hans': {
    navs: {
      overview: '概览',
      proxies: '代理',
      rules: '规则',
      connections: '连接',
      logs: '日志',
      config: '配置',
    },
    stats: {
      upload: '上传',
      download: '下载',
      uploadTotal: '上传总量',
      downloadTotal: '下载总量',
      activeConnections: '活动连接',
      memoryUsage: '内存使用情况',
    },
  },
}

const useLanguage = () => {
  const [lang, setLang] = makePersisted(createSignal(navigator.language), {
    name: 'lang',
    storage: localStorage,
  })

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
