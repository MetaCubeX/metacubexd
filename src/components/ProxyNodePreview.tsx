import { ProxyPreviewBar, ProxyPreviewDots } from '~/components'
import { PROXIES_PREVIEW_TYPE } from '~/constants'
import { proxiesPreviewType } from '~/signals'

export const ProxyNodePreview = (props: {
  proxyNameList: string[]
  testUrl: string | null
  now?: string
}) => {
  const off = () => proxiesPreviewType() === PROXIES_PREVIEW_TYPE.OFF

  const isSmallGroup = createMemo(() => props.proxyNameList.length <= 10)

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
      type === PROXIES_PREVIEW_TYPE.DOTS ||
      (type === PROXIES_PREVIEW_TYPE.Auto && isSmallGroup())
    )
  })

  return (
    <Show when={!off()}>
      <Switch>
        <Match when={isShowBar()}>
          <ProxyPreviewBar
            proxyNameList={props.proxyNameList}
            testUrl={props.testUrl}
            now={props.now}
          />
        </Match>

        <Match when={isShowDots()}>
          <ProxyPreviewDots
            proxyNameList={props.proxyNameList}
            testUrl={props.testUrl}
            now={props.now}
          />
        </Match>
      </Switch>
    </Show>
  )
}
