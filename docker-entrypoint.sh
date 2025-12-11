#!/bin/sh

# Sanitize the DEFAULT_BACKEND_URL by escaping special characters for JavaScript
sanitize_url() {
  # Replace backslashes, single quotes, and control characters
  printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g; s/\"/\\\\\"/g"
}

SANITIZED_URL=$(sanitize_url "${DEFAULT_BACKEND_URL:-}")

# Generate config.js from environment variables
cat > /app/.output/public/config.js << EOF
window.__METACUBEXD_CONFIG__ = {
  defaultBackendURL: '${SANITIZED_URL}',
}
EOF

# Start Node.js server
exec node /app/.output/server/index.mjs
