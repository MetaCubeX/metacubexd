// packages/ui/composables/useMenuKeyboard.ts
import type { Ref } from 'vue'
import { nextTick } from 'vue'

export interface MenuKeyboardOptions {
  // Reactive open flag for the popup menu.
  isOpen: Ref<boolean>
  // The trigger button — focus returns here on keyboard close / selection.
  triggerEl: Ref<HTMLElement | null>
  // The (often Teleported) menu container; its items are queried for roving.
  menuEl: Ref<HTMLElement | null>
  // Close the menu (sets isOpen false + any side effects).
  close: () => void
  // Selector for the focusable menu items inside menuEl.
  itemSelector?: string
}

// Keyboard + focus behaviour for a custom popup menu (a trigger <button> plus a
// floating list of <button> items): focus into the menu on open, restore focus
// to the trigger on keyboard close, and Escape / Arrow / Home / End navigation.
// Activation (Enter/Space) is left to the native <button>s. Kept UI-framework
// free (no .vue) so it unit-tests without @vue/test-utils.
export function useMenuKeyboard(options: MenuKeyboardOptions) {
  const { isOpen, triggerEl, menuEl, close } = options
  const itemSelector = options.itemSelector ?? '[role="menuitem"]'

  // SPA build (ssr:false) so document always exists at runtime; the guard keeps
  // it safe under non-jsdom / SSR-style test contexts too.
  const isClient = typeof document !== 'undefined'

  const items = (): HTMLElement[] =>
    menuEl.value
      ? Array.from(menuEl.value.querySelectorAll<HTMLElement>(itemSelector))
      : []

  const focusAt = (index: number) => {
    const list = items()
    if (!list.length) return
    const i = ((index % list.length) + list.length) % list.length
    list[i]?.focus()
  }

  // Focus the item flagged current (the selected option), else the first.
  const focusActiveOrFirst = () => {
    const list = items()
    if (!list.length) return
    const active = list.findIndex(
      (el) =>
        el.getAttribute('aria-current') === 'true' ||
        el.dataset.current === 'true',
    )
    list[active >= 0 ? active : 0]?.focus()
  }

  const indexOfFocused = (): number =>
    isClient ? items().indexOf(document.activeElement as HTMLElement) : -1

  watch(isOpen, (open, wasOpen) => {
    if (!isClient) return
    if (open) {
      void nextTick(focusActiveOrFirst)
    } else if (wasOpen) {
      // Restore focus to the trigger only when focus is still inside the menu
      // (Escape / selection) — never yank it back when a click moved focus
      // somewhere else (mouse dismiss).
      const active = document.activeElement
      if (
        !active ||
        active === document.body ||
        menuEl.value?.contains(active)
      ) {
        triggerEl.value?.focus()
      }
    }
  })

  const onKeydown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'ArrowDown':
        e.preventDefault()
        focusAt(indexOfFocused() + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusAt(indexOfFocused() - 1)
        break
      case 'Home':
        e.preventDefault()
        focusAt(0)
        break
      case 'End':
        e.preventDefault()
        focusAt(items().length - 1)
        break
    }
  }

  return { onKeydown, focusActiveOrFirst }
}
