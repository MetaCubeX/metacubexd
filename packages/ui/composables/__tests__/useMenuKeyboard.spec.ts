// packages/ui/composables/__tests__/useMenuKeyboard.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useMenuKeyboard } from '../useMenuKeyboard'

const flush = () => new Promise((r) => setTimeout(r, 0))

function setup(currentIndex = -1) {
  const trigger = document.createElement('button')
  trigger.textContent = 'trigger'

  const menu = document.createElement('div')
  menu.setAttribute('role', 'menu')

  const items = ['a', 'b', 'c'].map((label, i) => {
    const b = document.createElement('button')
    b.setAttribute('role', 'menuitem')
    if (i === currentIndex) b.dataset.current = 'true'
    b.textContent = label
    menu.appendChild(b)
    return b
  })

  document.body.append(trigger, menu)

  const isOpen = ref(false)
  const close = vi.fn(() => {
    isOpen.value = false
  })
  const triggerEl = ref<HTMLElement | null>(trigger)
  const menuEl = ref<HTMLElement | null>(menu)

  let api!: ReturnType<typeof useMenuKeyboard>
  const scope = effectScope()
  scope.run(() => {
    api = useMenuKeyboard({ isOpen, triggerEl, menuEl, close })
  })

  return { trigger, menu, items, isOpen, close, api, scope }
}

const key = (k: string) => new KeyboardEvent('keydown', { key: k })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('composables/useMenuKeyboard', () => {
  it('closes the menu on Escape', () => {
    const { api, close } = setup()
    api.onKeydown(key('Escape'))
    expect(close).toHaveBeenCalledOnce()
  })

  it('roves focus across items with ArrowDown / ArrowUp, wrapping at the ends', () => {
    const { api, items } = setup()
    items[0]!.focus()

    api.onKeydown(key('ArrowDown'))
    expect(document.activeElement).toBe(items[1])

    api.onKeydown(key('ArrowUp'))
    expect(document.activeElement).toBe(items[0])

    // wrap backwards to the last item
    api.onKeydown(key('ArrowUp'))
    expect(document.activeElement).toBe(items[2])

    // wrap forwards to the first item
    api.onKeydown(key('ArrowDown'))
    expect(document.activeElement).toBe(items[0])
  })

  it('jumps to the first / last item with Home / End', () => {
    const { api, items } = setup()
    items[1]!.focus()

    api.onKeydown(key('End'))
    expect(document.activeElement).toBe(items[2])

    api.onKeydown(key('Home'))
    expect(document.activeElement).toBe(items[0])
  })

  it('focuses the current item on open (else the first)', async () => {
    const { isOpen, items } = setup(2)
    isOpen.value = true
    await flush()
    expect(document.activeElement).toBe(items[2])
  })

  it('restores focus to the trigger on keyboard close (focus still inside menu)', async () => {
    const { isOpen, trigger, items } = setup()
    isOpen.value = true
    await flush()
    expect(document.activeElement).toBe(items[0])

    isOpen.value = false
    await flush()
    expect(document.activeElement).toBe(trigger)
  })

  it('does NOT pull focus back to the trigger when a click moved focus outside', async () => {
    const { isOpen, trigger } = setup()
    const outside = document.createElement('input')
    document.body.appendChild(outside)

    isOpen.value = true
    await flush()
    outside.focus() // user clicked something else to dismiss

    isOpen.value = false
    await flush()
    expect(document.activeElement).toBe(outside)
    expect(document.activeElement).not.toBe(trigger)
  })
})
