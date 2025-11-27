#!/bin/sh

# Generate config.js from environment variables
cat > /srv/config.js << EOF
window.__METACUBEXD_CONFIG__ = {
  defaultBackendURL: '${DEFAULT_BACKEND_URL:-}',
}
EOF

# Start Caddy
exec caddy run
