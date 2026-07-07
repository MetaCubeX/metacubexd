import { defineNitroPlugin } from 'nitropack/runtime'
import { getAgent } from '../lib/supervisor'

// All-in-One server: Nitro is otherwise lazy — the agent only acts on
// /api/control requests — so without this the bundled mihomo never spawns and
// CLASH_API_PORT / MIXED_PORT stay closed. The container then can't keep the
// README's "supervises the kernel, and exposes the proxy" promise: the panel
// loads on 8080 but /version on 9090 is connection-refused (#2067).
//
// Start it on boot, fire-and-forget so a slow or failing kernel can't wedge
// server startup; the supervisor's crash watchdog and the dashboard's Start
// action cover recovery. With no profile yet, the supervisor writes a header-only
// active config (external-controller/secret/mixed-port) and mihomo runs on its
// defaults — enough for the dashboard to connect; importing a profile restarts it.
export default defineNitroPlugin(() => {
  const { supervisor, scheduler } = getAgent()
  console.log('[kernel] starting bundled mihomo on boot…')
  supervisor
    .start()
    .then((s) =>
      console.log(`[kernel] ${s.status}${s.pid ? ` (pid ${s.pid})` : ''}`),
    )
    .catch((err) => console.error('[kernel] failed to start on boot:', err))

  // Drive subscription auto-update: remote profiles whose updateInterval has
  // elapsed refresh on each 60s tick, and the active one re-composes + restarts
  // so the new subscription takes effect without external cron (#2107). The
  // desktop builds its own scheduler (with notifications); only the server uses
  // the agent's, so starting it here is server-only behavior.
  scheduler.start()
  console.log('[profiles] auto-update scheduler started')
})
