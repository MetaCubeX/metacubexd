import { A } from '@solidjs/router'
import { endpoint } from '~/signals'

export const EndPointLabel = (pros: { class?: string }) => {
  return (
    <A
      href="/setup"
      class={
        (pros.class ?? '') +
        ' bg-gradient-to-br from-primary to-secondary bg-clip-text normal-case text-transparent'
      }
    >
      {endpoint()?.url}
    </A>
  )
}
