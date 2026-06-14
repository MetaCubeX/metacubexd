import { defineEventHandler, fromNodeMiddleware, toNodeListener } from 'h3'
import { getAgent } from '../../../lib/supervisor'

// The agent router is an h3 app whose internal routes are absolute,
// i.e. it answers '/api/control/...'. Because this file lives at
// routes/api/control/[...].ts it only receives requests already under
// '/api/control', and we forward the ORIGINAL url (event.node.req.url still
// carries the full '/api/control/...' path) to the agent listener.
const listener = toNodeListener(getAgent().router)

export default defineEventHandler(
  fromNodeMiddleware((req, res, _next) => {
    // toNodeListener fully handles the response (including 404s) and catches
    // errors itself, returning void — the agent owns the entire /api/control
    // namespace, so there is nothing to forward to `next`. (_next is kept only
    // so h3 selects the typed NodeMiddleware overload for req/res.)
    listener(req, res)
  }),
)
