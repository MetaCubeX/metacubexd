# metacubexd

Clash-Meta Dashboard

## Published Official Links

GH Pages Custom Domain: http://d.metacubex.one

GH Pages: https://metacubex.github.io/metacubexd

Cloudflare Pages: https://metacubexd.pages.dev

![preview](docs/preview.webp)

## Usage

### Run inside Docker

> docker cli

Running

```shell
docker run -d --restart always -p 80:80 --name metacubexd ghcr.io/metacubex/metacubexd
```

Update and restart

```shell
docker pull ghcr.io/metacubex/metacubexd && docker restart metacubexd
```

> docker-compose.yml

```yaml
version: '3'

services:
  metacubexd:
    container_name: metacubexd
    image: ghcr.io/metacubex/metacubexd
    restart: always
    ports:
      - 80:80

  # optional
  meta:
    container_name: meta
    image: docker.io/metacubex/clash-meta:Alpha
    restart: always
    network_mode: host
    cap_add:
      - NET_ADMIN
    volumes:
      - ./config.yaml:/root/.config/clash
```

Running

```shell
docker compose up -d
```

Update and restart

```shell
docker compose pull && docker compose up -d
```

### Build locally

> Install npm dependencies

```shell
pnpm install
```

> Build artifacts

```shell
pnpm build
```

> Serve static files

```shell
pnpm serve
```
