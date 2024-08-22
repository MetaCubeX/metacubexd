# metacubexd

Mihomo Dashboard, The Official One, XD

![preview-overview](https://assets.solidjs.com/banner?project=metacubexd)

![pr-closed](https://img.shields.io/github/issues-pr-closed/metacubex/metacubexd?style=for-the-badge)
![last-commit](https://img.shields.io/github/last-commit/metacubex/metacubexd?style=for-the-badge)
![build](https://img.shields.io/github/actions/workflow/status/metacubex/metacubexd/release.yml?style=for-the-badge)
![downloads](https://img.shields.io/github/downloads/metacubex/metacubexd/total?style=for-the-badge)
![license](https://img.shields.io/github/license/metacubex/metacubexd?style=for-the-badge)

## Preview

![preview-overview](docs/preview-overview.webp)
![preview-connections](docs/preview-connections.webp)

## Published Official Links

GH Pages: https://metacubex.github.io/metacubexd

Cloudflare Pages: https://metacubexd.pages.dev

## Usage

### Enable external-controller in your config file

```yaml
external-controller: 0.0.0.0:9090
```

### Use pre-built assets from gh-pages branch

> First time setup

```shell
git clone https://github.com/metacubex/metacubexd.git -b gh-pages /etc/mihomo/ui
```

Make sure you have external-ui directory set correctly in your config file

```yaml
external-ui: /etc/mihomo/ui
```

> Update

```shell
git -C /etc/mihomo/ui pull -r
```

### Run inside Docker

> docker cli

Running

```shell
docker run -d --restart always -p 80:80 --name metacubexd ghcr.io/metacubex/metacubexd
```

Update and Restart

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
      - '80:80'

  # optional
  meta:
    container_name: meta
    image: docker.io/metacubex/mihomo:Alpha
    restart: always
    pid: host
    ipc: host
    network_mode: host
    cap_add:
      - ALL
    volumes:
      - ./config.yaml:/root/.config/mihomo
      - /dev/net/tun:/dev/net/tun
```

Running

```shell
docker compose up -d
```

Update and Restart

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

## Credits

- [SolidJS](https://github.com/solidjs/solid)
- [daisyUI](https://github.com/saadeghi/daisyui)
