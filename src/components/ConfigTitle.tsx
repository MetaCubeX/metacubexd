import type { ParentComponent } from 'solid-js'

export const ConfigTitle: ParentComponent<{ withDivider?: boolean }> = (
  props,
) => (
  <div
    class="py-2 text-center text-lg font-semibold"
    classList={{
      divider: props.withDivider,
    }}
  >
    {children(() => props.children)()}
  </div>
)
