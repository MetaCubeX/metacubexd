# syntax=docker/dockerfile:1
# Standalone metacubexd panel (Nuxt node-server, ships only the dashboard).
# Build context MUST be the repo root: docker buildx build -f packages/ui/Dockerfile .

# ---- Stage 1: build the Nuxt node-server output (on the builder's native arch) ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @metacubexd/ui build
# -> /repo/packages/ui/.output (Nitro node-server preset, serves the CSR panel)

# ---- Stage 2: slim runtime ----
FROM node:22-alpine
ENV PORT=80 NODE_ENV=production
EXPOSE 80
WORKDIR /app
COPY --from=builder /repo/packages/ui/.output ./.output
COPY packages/ui/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
CMD ["/docker-entrypoint.sh"]
