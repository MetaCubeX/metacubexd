import { Show, createMemo } from 'solid-js'
import { PROXIES_PREVIEW_TYPE } from '~/config/enum'
import { proxiesPreviewType } from '~/pages/Config'
import ProxyPreviewBar from './ProxyPreviewBar'
import ProxyPreviewDots from './ProxyPreviewDots'

export default (props: { proxyNameList: string[]; now?: string }) => {
  const isSmallGroup = createMemo(() => props.proxyNameList.length <= 30)
  const isShowBar = createMemo(() => {
    const type = proxiesPreviewType()

    return (
      type === PROXIES_PREVIEW_TYPE.BAR ||
      (type === PROXIES_PREVIEW_TYPE.Auto && !isSmallGroup())
    )
  })

  const isShowDots = createMemo(() => {
    const type = proxiesPreviewType()

    return (
      type === PROXIES_PREVIEW_TYPE.BAR ||
      (type === PROXIES_PREVIEW_TYPE.Auto && isSmallGroup())
    )
  })

  return (
    <>
      <Show when={isShowBar()}>
        <ProxyPreviewBar proxyNameList={props.proxyNameList} now={props.now} />
      </Show>
      <Show when={isShowDots()}>
        <ProxyPreviewDots proxyNameList={props.proxyNameList} now={props.now} />
      </Show>
    </>
  )
}
