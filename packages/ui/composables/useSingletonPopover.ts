let activeClose: (() => void) | null = null

export function acquireSingletonPopover(close: () => void) {
  if (activeClose && activeClose !== close) {
    const previousClose = activeClose
    activeClose = null
    previousClose()
  }
  activeClose = close
}

export function releaseSingletonPopover(close: () => void) {
  if (activeClose === close) {
    activeClose = null
  }
}
