import { createError, defineEventHandler, getQuery, getRequestHeader } from 'h3'
import { serverEnv } from '../lib/supervisor'

const CONTROL_PREFIX = '/api/control'
const PUBLIC_CONTROL_PATHS = new Set([`${CONTROL_PREFIX}/health`])

export interface AuthInput {
  path: string
  authHeader: string | undefined
  queryToken: string | undefined
  configuredToken: string
}

export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; message: string }

/**
 * Pure auth decision. Static UI (anything not under /api/control) is public.
 * /api/control/health is public. Every other /api/control/** request requires
 * a matching token via `Authorization: Bearer <token>` OR (for SSE, which
 * cannot set headers in EventSource) a `?token=<token>` query param.
 */
export function isAuthorized(input: AuthInput): AuthResult {
  const { path, authHeader, queryToken, configuredToken } = input

  // Static UI + any non-control route: always public.
  if (!path.startsWith(CONTROL_PREFIX)) return { ok: true }

  // Public control endpoints (health).
  if (PUBLIC_CONTROL_PATHS.has(path)) return { ok: true }

  // Fail closed if the operator never configured a token.
  if (!configuredToken)
    return {
      ok: false,
      status: 503,
      message: 'CONTROL_TOKEN is not configured',
    }

  const bearer = parseBearer(authHeader)
  const presented = bearer ?? queryToken
  if (presented && presented === configuredToken) return { ok: true }

  return { ok: false, status: 401, message: 'Unauthorized' }
}

function parseBearer(header: string | undefined): string | undefined {
  if (!header) return undefined
  const m = /^bearer\s+(.+)$/i.exec(header.trim())
  return m ? m[1] : undefined
}

export default defineEventHandler((event) => {
  const result = isAuthorized({
    path: event.path.split('?')[0],
    authHeader: getRequestHeader(event, 'authorization'),
    queryToken: (getQuery(event).token as string | undefined) ?? undefined,
    configuredToken: serverEnv().controlToken,
  })
  if (!result.ok) {
    throw createError({
      statusCode: result.status,
      statusMessage: result.message,
    })
  }
})
