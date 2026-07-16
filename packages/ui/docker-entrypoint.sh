#!/bin/sh

set -eu

# Map DEFAULT_BACKEND_URL to Nuxt runtime config env var.
# Nitro embeds public asset metadata at build time, so do not rewrite config.js.
export NUXT_PUBLIC_DEFAULT_BACKEND_URL="${DEFAULT_BACKEND_URL:-}"
# GitHub Releases metadata is public, but authenticated requests have a much
# higher rate limit. The public runtime value is intentionally available to the
# browser, so use only a narrowly scoped/read-only token.
export NUXT_PUBLIC_GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# Start Node.js server
exec node /app/.output/server/index.mjs
