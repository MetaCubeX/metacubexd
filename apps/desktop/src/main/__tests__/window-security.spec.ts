import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { applyWindowSecurity, classifyTarget } from '../window-security'

const ORIGIN = 'http://127.0.0.1:34567'

describe('classifyTarget', () => {
  it('allows same-origin absolute and relative targets', () => {
    expect(classifyTarget(`${ORIGIN}/`, ORIGIN)).toBe('allow')
    expect(classifyTarget(`${ORIGIN}/#/proxies`, ORIGIN)).toBe('allow')
    expect(classifyTarget('/config', ORIGIN)).toBe('allow')
  })

  it('routes a foreign http/https origin to the system browser', () => {
    expect(classifyTarget('https://github.com/metacubex', ORIGIN)).toBe(
      'external',
    )
    expect(classifyTarget('http://example.com', ORIGIN)).toBe('external')
    // A different loopback PORT is still a different origin → external.
    expect(classifyTarget('http://127.0.0.1:9090/ui', ORIGIN)).toBe('external')
  })

  it('blocks non-web schemes', () => {
    expect(classifyTarget('file:///etc/passwd', ORIGIN)).toBe('block')
    expect(classifyTarget('data:text/html,<script>1</script>', ORIGIN)).toBe(
      'block',
    )
    expect(classifyTarget('javascript:alert(1)', ORIGIN)).toBe('block')
  })

  it('blocks an unparseable target', () => {
    expect(classifyTarget('http://[bad', ORIGIN)).toBe('block')
  })
})

// A WebContents double capturing the wired handlers.
function fakeWebContents() {
  let openHandler:
    | ((d: { url: string }) => { action: 'deny' } | { action: 'allow' })
    | undefined
  let navHandler:
    | ((event: { preventDefault: () => void }, url: string) => void)
    | undefined
  const wc = {
    setWindowOpenHandler: vi.fn((h: typeof openHandler) => {
      openHandler = h
    }),
    on: vi.fn((event: string, h: unknown) => {
      if (event === 'will-navigate') navHandler = h as typeof navHandler
      return wc
    }),
  }
  return {
    wc: wc as unknown as Pick<WebContents, 'on' | 'setWindowOpenHandler'>,
    openWindow: (url: string) => openHandler!({ url }),
    navigate: (url: string) => {
      const event = { preventDefault: vi.fn() }
      navHandler!(event, url)
      return event
    },
  }
}

describe('applyWindowSecurity — window open handler', () => {
  it('denies every popup but opens a foreign http link externally', () => {
    const { wc, openWindow } = fakeWebContents()
    const openExternal = vi.fn()
    applyWindowSecurity({
      webContents: wc,
      allowedOrigin: ORIGIN,
      openExternal,
    })

    expect(openWindow('https://docs.example.com')).toEqual({ action: 'deny' })
    expect(openExternal).toHaveBeenCalledWith('https://docs.example.com')
  })

  it('denies a popup to a non-web scheme without opening anything', () => {
    const { wc, openWindow } = fakeWebContents()
    const openExternal = vi.fn()
    applyWindowSecurity({
      webContents: wc,
      allowedOrigin: ORIGIN,
      openExternal,
    })

    expect(openWindow('file:///etc/passwd')).toEqual({ action: 'deny' })
    expect(openExternal).not.toHaveBeenCalled()
  })
})

describe('applyWindowSecurity — navigation guard', () => {
  it('allows same-origin navigation without preventing it', () => {
    const { wc, navigate } = fakeWebContents()
    const openExternal = vi.fn()
    applyWindowSecurity({
      webContents: wc,
      allowedOrigin: ORIGIN,
      openExternal,
    })

    const event = navigate(`${ORIGIN}/index.html`)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('prevents a foreign navigation and re-routes http/https externally', () => {
    const { wc, navigate } = fakeWebContents()
    const openExternal = vi.fn()
    applyWindowSecurity({
      webContents: wc,
      allowedOrigin: ORIGIN,
      openExternal,
    })

    const event = navigate('https://evil.example.com')
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(openExternal).toHaveBeenCalledWith('https://evil.example.com')
  })

  it('prevents a non-web navigation and opens nothing', () => {
    const { wc, navigate } = fakeWebContents()
    const openExternal = vi.fn()
    applyWindowSecurity({
      webContents: wc,
      allowedOrigin: ORIGIN,
      openExternal,
    })

    const event = navigate('file:///etc/passwd')
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(openExternal).not.toHaveBeenCalled()
  })
})

describe('applyWindowSecurity — permission handler', () => {
  it('denies every permission request', () => {
    const { wc } = fakeWebContents()
    let installed:
      | ((wc: WebContents, p: string, cb: (g: boolean) => void) => void)
      | undefined
    applyWindowSecurity({
      webContents: wc,
      allowedOrigin: ORIGIN,
      openExternal: vi.fn(),
      setPermissionRequestHandler: (h) => {
        installed = h
      },
    })
    const cb = vi.fn()
    installed!({} as WebContents, 'geolocation', cb)
    expect(cb).toHaveBeenCalledWith(false)
  })
})
