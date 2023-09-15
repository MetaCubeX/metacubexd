import { children, ParentComponent } from 'solid-js'

export const ConfigTitle: ParentComponent<{ withDivider?: boolean }> = (
  props,
) => (
  <div
    class="pb-4 text-lg font-semibold"
    classList={{
      divider: props.withDivider,
    }}
  >
    {children(() => props.children)()}
  </div>
)
