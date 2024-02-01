FROM docker.io/oven/bun:alpine as builder

WORKDIR /build

COPY . .

RUN bun install
RUN bun run build

FROM docker.io/caddy:alpine

EXPOSE 80

WORKDIR /srv

COPY --from=builder /build/dist/. .
COPY Caddyfile .

CMD ["caddy", "run"]
