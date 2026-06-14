# syntax=docker/dockerfile:1
# Build context MUST be the repo root: docker buildx build -f apps/server/Dockerfile .

# ---- Stage 1: build the static UI (on the builder's native arch) ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @metacubexd/ui generate
# -> /repo/packages/ui/.output/public

# ---- Stage 2: build the standalone Nitro server + agent ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS server
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @metacubexd/server... build
# -> /repo/apps/server/.output

# ---- Stage 3: fetch the TARGET-arch mihomo kernel (normal stage = real TARGETARCH) ----
FROM alpine:3.20 AS kernel
ARG TARGETARCH
ARG MIHOMO_VERSION=v1.19.27
RUN apk add --no-cache curl ca-certificates gzip
RUN set -eux; \
    if   [ "$TARGETARCH" = "amd64" ]; then ASSET=mihomo-linux-amd64-compatible-${MIHOMO_VERSION}.gz; \
    elif [ "$TARGETARCH" = "arm64" ]; then ASSET=mihomo-linux-arm64-${MIHOMO_VERSION}.gz; \
    else echo "unsupported arch $TARGETARCH" >&2; exit 1; fi; \
    curl -fsSL "https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/${ASSET}" -o /tmp/k.gz; \
    gunzip -c /tmp/k.gz > /usr/local/bin/mihomo; \
    chmod +x /usr/local/bin/mihomo; \
    /usr/local/bin/mihomo -v

# ---- Stage 4: slim runtime ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache ca-certificates tzdata tini wget
WORKDIR /app
COPY --from=server  /repo/apps/server/.output ./
COPY --from=ui      /repo/packages/ui/.output/public ./ui-dist
COPY --from=kernel  /usr/local/bin/mihomo /usr/local/bin/mihomo
COPY apps/server/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENV NODE_ENV=production \
    UI_DIST=/app/ui-dist \
    MIHOMO_BIN=/usr/local/bin/mihomo \
    DATA_DIR=/data \
    CONTROL_PORT=8080 \
    CLASH_API_PORT=9090 \
    MIXED_PORT=7890
VOLUME ["/data"]
EXPOSE 8080 9090 7890
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${CONTROL_PORT}/api/control/health" || exit 1
# tini is PID 1 so the mihomo subprocess spawned by the server is reaped on kill/restart.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/docker-entrypoint.sh"]
