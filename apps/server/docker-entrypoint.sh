#!/bin/sh
set -eu

# Ensure the persisted data directory exists and is writable.
# mihomo's home (geo/fakeip caches), profiles/, and active.yaml all live here.
mkdir -p "${DATA_DIR:-/data}/profiles"

# Nitro's node-server binds NITRO_PORT/PORT (default 3000). Map the documented
# CONTROL_PORT onto it so the dashboard/control server listens where the README,
# compose, EXPOSE and HEALTHCHECK all promise (default 8080) — see #2056.
export PORT="${CONTROL_PORT:-8080}"

# Hand off to the Nitro node server as PID-1's child (tini reaps the kernel
# subprocess this server spawns).
exec node /app/server/index.mjs
