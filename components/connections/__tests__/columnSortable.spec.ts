import { useSortable } from '@vueuse/integrations/useSortable'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createConnectionsColumnSortableOptions } from '../columnSortable'

describe('connections column sortable options', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('initializes sortable when the modal column list is rendered after mount', async () => {
    const host = document.createElement('div')
    document.body.append(host)

    let open!: () => void
    let sortable!: ReturnType<typeof useSortable<string>>

    const app = createApp(
      defineComponent({
        setup() {
          const rendered = ref(false)
          const listRef = ref<HTMLElement | null>(null)
          const list = ref(['close', 'type', 'process'])

          open = () => {
            rendered.value = true
          }

          sortable = useSortable(
            listRef,
            list,
            createConnectionsColumnSortableOptions(),
          )

          return () =>
            rendered.value
              ? h(
                  'div',
                  { ref: listRef },
                  list.value.map((id) =>
                    h(
                      'div',
                      { key: id },
                      h('span', { class: 'drag-handle' }, id),
                    ),
                  ),
                )
              : null
        },
      }),
    )

    app.mount(host)
    expect(sortable.option('animation')).toBeUndefined()

    open()
    await nextTick()
    await nextTick()

    expect(sortable.option('animation')).toBe(150)

    app.unmount()
  })
})
