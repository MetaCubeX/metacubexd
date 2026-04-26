#!/bin/sh

set -eu

# Map DEFAULT_BACKEND_URL to Nuxt runtime config env var
# Nuxt automatically maps NUXT_PUBLIC_* env vars to runtimeConfig.public.*
export NUXT_PUBLIC_DEFAULT_BACKEND_URL="${DEFAULT_BACKEND_URL:-}"

# Also write config.js for backward compatibility (static hosting fallback)
# Note: In Node.js mode, runtimeConfig takes priority over config.js
CONFIG_JSON=$(node -e 'process.stdout.write(JSON.stringify({ defaultBackendURL: process.env.DEFAULT_BACKEND_URL || "" }))')

mkdir -p /app/.output/public
cat > /app/.output/public/config.js << EOF
window.__METACUBEXD_CONFIG__ = ${CONFIG_JSON};
EOF

# Start Node.js server
exec node /app/.output/server/index.mjs
