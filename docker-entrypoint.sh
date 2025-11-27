#!/bin/sh

# Sanitize the DEFAULT_BACKEND_URL by escaping special characters for JavaScript
sanitize_url() {
  # Replace backslashes, single quotes, and control characters
  printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g; s/\"/\\\\\"/g"
}

SANITIZED_URL=$(sanitize_url "${DEFAULT_BACKEND_URL:-}")

# Generate config.js from environment variables
cat > /srv/config.js << EOF
window.__METACUBEXD_CONFIG__ = {
  defaultBackendURL: '${SANITIZED_URL}',
}
EOF

# Start Caddy
exec caddy run
