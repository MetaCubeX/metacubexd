/**
 * Renderer hardening for the main window (Electron security checklist). The UI
 * is served from ONE fixed loopback origin (the control server); treat anything
 * else as foreign. Three guards, all wired from createWindow():
 *
 *  - setWindowOpenHandler: deny every in-app popup/new BrowserWindow. A foreign
 *    http/https link (e.g. a docs link in the dashboard) is handed to the system
 *    browser instead; non-web schemes are dropped.
 *  - will-navigate: lock top-level navigation to the renderer origin so a
 *    compromised/redirecting page can't replace the app shell with a remote
 *    origin. (SPA hash routing is same-document and never reaches will-navigate.)
 *  - permission requests: deny all (geolocation/camera/mic/web-notifications/…).
 *    Desktop notifications use the main-process Electron Notification API, not
 *    the web Permissions API, so nothing the app needs is affected.
 *
 * The routing/classification is a pure function (classifyTarget) so the policy
 * is unit-tested independently of Electron.
 */

import type { WebContents } from 'electron'

/** allow = same-origin in-window; external = open in system browser; block = drop. */
export type NavDecision = 'allow' | 'external' | 'block'

/**
 * Classify a navigation/popup target relative to the renderer origin. Same
 * origin (incl. relative URLs / SPA routes) → allow; a different http/https
 * origin → external; anything else (file:, data:, javascript:, blob:, …) →
 * block. A target that can't be parsed against the base is blocked.
 */
export function classifyTarget(
  target: string,
  allowedOrigin: string,
): NavDecision {
  let u: URL
  try {
    u = new URL(target, allowedOrigin)
  } catch {
    return 'block'
  }
  if (u.origin === allowedOrigin) return 'allow'
  if (u.protocol === 'http:' || u.protocol === 'https:') return 'external'
  return 'block'
}

/** Minimal permission-handler installer (session.setPermissionRequestHandler). */
export type SetPermissionRequestHandler = (
  handler: (
    webContents: WebContents,
    permission: string,
    callback: (granted: boolean) => void,
  ) => void,
) => void

export interface WindowSecurityDeps {
  /** Narrowed to what we wire; the real win.webContents satisfies it. */
  webContents: Pick<WebContents, 'on' | 'setWindowOpenHandler'>
  /** Origin the renderer is served from, e.g. http://127.0.0.1:34567 (no path). */
  allowedOrigin: string
  /** Open a URL in the system browser (injected; shell.openExternal). */
  openExternal: (url: string) => void
  /**
   * Installs the session permission handler (session.setPermissionRequestHandler).
   * Optional so tests can omit it; createWindow passes the window's session.
   */
  setPermissionRequestHandler?: SetPermissionRequestHandler
}

export function applyWindowSecurity({
  webContents,
  allowedOrigin,
  openExternal,
  setPermissionRequestHandler,
}: WindowSecurityDeps): void {
  webContents.setWindowOpenHandler(({ url }) => {
    if (classifyTarget(url, allowedOrigin) === 'external') openExternal(url)
    return { action: 'deny' }
  })

  webContents.on('will-navigate', (event, url) => {
    const decision = classifyTarget(url, allowedOrigin)
    if (decision === 'allow') return
    event.preventDefault()
    if (decision === 'external') openExternal(url)
  })

  // Deny every renderer permission request.
  setPermissionRequestHandler?.((_wc, _permission, callback) => callback(false))
}
