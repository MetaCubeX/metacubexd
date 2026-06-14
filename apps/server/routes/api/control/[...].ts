import { defineEventHandler, fromNodeMiddleware, toNodeListener } from 'h3'
import { getAgent } from '../../../lib/supervisor'

// The agent router is an h3 app whose internal routes are absolute,
// i.e. it answers '/api/control/...'. Because this file lives at
// routes/api/control/[...].ts it only receives requests already under
// '/api/control', and we forward the ORIGINAL url (event.node.req.url still
// carries the full '/api/control/...' path) to the agent listener.
const listener = toNodeListener(getAgent().router)

export default defineEventHandler(
  fromNodeMiddleware((req, res, next) => {
    listener(req, res).catch(next)
  }),
)
