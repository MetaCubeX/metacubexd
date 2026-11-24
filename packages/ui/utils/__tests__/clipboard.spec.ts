import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyText } from '../clipboard'

describe('copyText', () => {
  const writeText = vi.fn()
  const execCommand = vi.fn()

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined)
    execCommand.mockReset().mockReturnValue(true)
    vi.stubGlobal('isSecureContext', true)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'clipboard')
    Reflect.deleteProperty(document, 'execCommand')
    document.body.replaceChildren()
    document.getSelection()?.removeAllRanges()
  })

  it('uses the Clipboard API in a secure context', async () => {
    expect(await copyText('example.com')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('example.com')
    expect(execCommand).not.toHaveBeenCalled()
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('copies synchronously on insecure HTTP, before yielding the click handler', async () => {
    vi.stubGlobal('isSecureContext', false)
    execCommand.mockImplementation(() => {
      const textarea = document.activeElement as HTMLTextAreaElement
      expect(textarea.value).toBe('узел.example:443')
      expect(textarea.selectionStart).toBe(0)
      expect(textarea.selectionEnd).toBe(textarea.value.length)
      return true
    })

    const result = copyText('узел.example:443')

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(writeText).not.toHaveBeenCalled()
    expect(await result).toBe(true)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back when the Clipboard API is missing', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')

    expect(await copyText('example.com')).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('tries the fallback when the Clipboard API rejects', async () => {
    writeText.mockRejectedValue(new Error('Clipboard denied'))

    expect(await copyText('example.com')).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('keeps the fallback inside the active dialog', async () => {
    vi.stubGlobal('isSecureContext', false)
    const dialog = document.createElement('dialog')
    dialog.open = true
    const button = document.createElement('button')
    dialog.appendChild(button)
    document.body.appendChild(dialog)
    button.focus()
    execCommand.mockImplementation(
      () =>
        dialog.contains(document.activeElement) &&
        document.activeElement instanceof HTMLTextAreaElement,
    )

    expect(await copyText('https://example.com/subscription')).toBe(true)
    expect(document.querySelector('textarea')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it.each(['success', 'refusal', 'exception'])(
    'cleans up and restores focus and selection after fallback %s',
    async (outcome) => {
      vi.stubGlobal('isSecureContext', false)
      const button = document.createElement('button')
      const text = document.createElement('p')
      text.textContent = 'previous selection'
      document.body.append(button, text)
      button.focus()
      const range = document.createRange()
      range.selectNodeContents(text)
      document.getSelection()!.removeAllRanges()
      document.getSelection()!.addRange(range)
      expect(document.getSelection()!.toString()).toBe('previous selection')
      execCommand.mockImplementation(() => {
        document.getSelection()!.removeAllRanges()
        if (outcome === 'exception') throw new Error('Copy failed')
        return outcome === 'success'
      })

      expect(await copyText('example.com')).toBe(outcome === 'success')
      expect(document.querySelector('textarea')).toBeNull()
      expect(document.activeElement).toBe(button)
      expect(document.getSelection()!.toString()).toBe('previous selection')
    },
  )
})
