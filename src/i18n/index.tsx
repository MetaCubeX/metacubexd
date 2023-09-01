import { I18nContext, createI18nContext, useI18n } from '@solid-primitives/i18n'
import { makePersisted } from '@solid-primitives/storage'
import { ParentComponent, createEffect, createSignal } from 'solid-js'

const dict = {
  'en-US': {
    add: 'Add',
    overview: 'Overview',
    proxies: 'Proxies',
    rules: 'Rules',
    connections: 'Connections',
    logs: 'Logs',
    config: 'Config',
    upload: 'Upload',
    download: 'Download',
    uploadTotal: 'Upload Total',
    downloadTotal: 'Download Total',
    activeConnections: 'Active Connections',
    memoryUsage: 'Memory Usage',
    traffic: 'Traffic',
    memory: 'Memory',
    down: 'Down',
    up: 'Up',
    proxyProviders: 'Proxy Providers',
    ruleProviders: 'Rule Providers',
    search: 'Search',
    type: 'Type',
    name: 'Name',
    process: 'Process',
    host: 'Host',
    chains: 'Chains',
    dlSpeed: 'DL Speed',
    ulSpeed: 'UL Speed',
    dl: 'DL',
    ul: 'UL',
    source: 'Source',
    destination: 'Destination',
    close: 'Close',
  },
  'zh-Hans': {
    add: '添加',
    overview: '概览',
    proxies: '代理',
    rules: '规则',
    connections: '连接',
    logs: '日志',
    config: '配置',
    upload: '上传',
    download: '下载',
    uploadTotal: '上传总量',
    downloadTotal: '下载总量',
    activeConnections: '活动连接',
    memoryUsage: '内存使用情况',
    traffic: '流量',
    memory: '内存',
    down: '下载',
    up: '上传',
    proxyProviders: '代理提供者',
    ruleProviders: '规则提供者',
    search: '搜索',
    type: '类型',
    name: '名字',
    process: '进程',
    host: '主机',
    chains: '链路',
    dlSpeed: '下载速度',
    ulSpeed: '上传速度',
    dl: '下载量',
    ul: '上传量',
    source: '源地址',
    destination: '目标地址',
    close: '关闭',
  },
}

const useLanguage = () => {
  const [lang, setLang] = makePersisted(
    createSignal(
      Reflect.has(dict, navigator.language) ? navigator.language : 'en-US',
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
