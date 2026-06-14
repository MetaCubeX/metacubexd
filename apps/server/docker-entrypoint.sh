#!/bin/sh
set -eu

# Ensure the persisted data directory exists and is writable.
# mihomo's home (geo/fakeip caches), profiles/, and active.yaml all live here.
mkdir -p "${DATA_DIR:-/data}/profiles"

# Hand off to the Nitro node server as PID-1's child (tini reaps the kernel
# subprocess this server spawns).
exec node /app/server/index.mjs
