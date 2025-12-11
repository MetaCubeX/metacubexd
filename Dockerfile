FROM docker.io/node:alpine AS builder

USER root
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV HUSKY=0
WORKDIR /build

COPY . .

RUN npm install --force -g corepack
RUN corepack enable
RUN corepack install
RUN pnpm install
RUN pnpm build

FROM docker.io/node:alpine

ENV PORT=80
# Default config directory for server mode
ENV NUXT_CONFIG_DIR=/config
EXPOSE 80

WORKDIR /app

# Copy the entire Nuxt server output
COPY --from=builder /build/.output ./.output
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create default config directory
RUN mkdir -p /config

# Volume for config files
VOLUME ["/config"]

CMD ["/docker-entrypoint.sh"]
