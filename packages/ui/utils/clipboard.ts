export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Try the fallback if the browser still permits copying from this click.
    }
  }

  const activeElement = document.activeElement
  const selection = document.getSelection()
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, i) =>
        selection.getRangeAt(i).cloneRange(),
      )
    : []
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'

  try {
    // Modal dialogs only allow focus inside the dialog.
    ;(activeElement?.closest('dialog[open]') ?? document.body).appendChild(
      textarea,
    )
    textarea.focus({ preventScroll: true })
    textarea.select()
    // shortcut: legacy HTTP support depends on the browser, remove when HTTP support ends.
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
    if (activeElement instanceof HTMLElement) {
      activeElement.focus({ preventScroll: true })
    }
    if (selection) {
      selection.removeAllRanges()
      for (const range of ranges) selection.addRange(range)
    }
  }
}
