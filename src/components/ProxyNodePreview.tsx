import { Show } from 'solid-js'
import { PROXIES_PREVIEW_TYPE } from '~/config/enum'
import { proxiesPreviewType } from '~/pages/Config'
import ProxyPreviewBar from './ProxyPreviewBar'
import ProxyPreviewDots from './ProxyPreviewDots'

export default (props: { proxyNameList: string[]; now?: string }) => {
  return (
    <>
      <Show when={proxiesPreviewType() === PROXIES_PREVIEW_TYPE.BAR}>
        <ProxyPreviewBar proxyNameList={props.proxyNameList} now={props.now} />
      </Show>
      <Show when={proxiesPreviewType() === PROXIES_PREVIEW_TYPE.DOTS}>
        <ProxyPreviewDots proxyNameList={props.proxyNameList} now={props.now} />
      </Show>
    </>
  )
}
