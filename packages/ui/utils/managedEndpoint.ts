import type { Endpoint } from '~/types'
import type { KernelState } from '~/types/control'

type Connection = Pick<Endpoint, 'url' | 'secret'>

function normalizedUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

function matchesEndpoint(endpoint: Connection, managed: Connection): boolean {
  const url = normalizedUrl(endpoint.url)
  return (
    url !== null &&
    url === normalizedUrl(managed.url) &&
    endpoint.secret === managed.secret
  )
}

/** Prove ownership before persisting a Clash API edit through the host's agent. */
export function createManagedEndpointCheck(
  readKernelState: () => Promise<KernelState>,
) {
  // The supervisor owns its controller address/secret for this app session.
  // Share the authenticated lookup across saves, but retry a failed lookup.
  let stateRequest: Promise<KernelState | null> | undefined

  return async (endpoint: Connection): Promise<boolean> => {
    if (typeof window === 'undefined') return false
    const bridge = (
      window as unknown as {
        metacubexd?: { isDesktop?: boolean; endpoint?: Connection }
      }
    ).metacubexd
    if (bridge?.isDesktop || bridge?.endpoint) {
      return !!bridge.endpoint && matchesEndpoint(endpoint, bridge.endpoint)
    }

    // /info is public and establishes capability, not endpoint ownership.
    // /kernel/status requires the Control API credential and supplies the
    // supervisor's actual controller and secret, including in AIO deployments.
    stateRequest ??= readKernelState().catch(() => {
      stateRequest = undefined
      return null
    })
    const state = await stateRequest
    if (!state) return false
    try {
      const controller = new URL(`http://${state.externalController}`)
      if (controller.hostname === '0.0.0.0' || controller.hostname === '[::]') {
        controller.hostname = new URL(window.location.origin).hostname
      }
      return matchesEndpoint(endpoint, {
        url: controller.href,
        secret: state.secret,
      })
    } catch {
      // Proxies with an unprovable public address remain usable for live
      // changes; do not risk persisting them to an unrelated local profile.
      return false
    }
  }
}
