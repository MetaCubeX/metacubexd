#!/bin/sh

# Map DEFAULT_BACKEND_URL to Nuxt runtime config env var
# Nuxt automatically maps NUXT_PUBLIC_* env vars to runtimeConfig.public.*
export NUXT_PUBLIC_DEFAULT_BACKEND_URL="${DEFAULT_BACKEND_URL:-}"

# Also write config.js for backward compatibility (static hosting fallback)
# Note: In Node.js mode, runtimeConfig takes priority over config.js
sanitize_url() {
  printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g; s/\"/\\\\\"/g"
}

SANITIZED_URL=$(sanitize_url "${DEFAULT_BACKEND_URL:-}")

cat > /app/.output/public/config.js << EOF
window.__METACUBEXD_CONFIG__ = {
  defaultBackendURL: '${SANITIZED_URL}',
}
EOF

# Start Node.js server
exec node /app/.output/server/index.mjs
