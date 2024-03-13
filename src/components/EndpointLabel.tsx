import { A } from '@solidjs/router'
import { twMerge } from 'tailwind-merge'
import { endpoint } from '~/signals'

export const EndpointLabel = (props: { class?: string }) => {
  return (
    <A
      href="/setup"
      class={twMerge(
        props.class,
        ' bg-gradient-to-br from-primary to-secondary bg-clip-text normal-case text-transparent',
      )}
    >
      {endpoint()?.url}
    </A>
  )
}
