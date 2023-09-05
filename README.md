# metacubexd

<p align="center">
  <img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2Fmetacubex%2Fmetacubexd&count_bg=%235C3DC8&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false" alt="hits" />
  <img src="https://custom-icon-badges.herokuapp.com/github/issues-pr-closed/metacubex/metacubexd?color=purple&logo=git-pull-request&logoColor=white" alt="pr/issue" />
  <img src="https://custom-icon-badges.herokuapp.com/github/last-commit/metacubex/metacubexd?logo=history&logoColor=white" alt="lastcommit" />
  <img src="https://github.com/metacubex/metacubexd/actions/workflows/release.yml/badge.svg" alt="build-status" />
  <img src="https://custom-icon-badges.herokuapp.com/github/v/release/metacubex/metacubexd?logo=rocket" alt="version">
  <img src="https://custom-icon-badges.herokuapp.com/github/license/metacubex/metacubexd?logo=law&color=orange" alt="license" />
</p>

<p align="center">Clash-Meta Dashboard</p>

## Preview

![preview](docs/preview.webp)

## Published Official Links

GH Pages Custom Domain: http://d.metacubex.one

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
git clone https://github.com/metacubex/metacubexd.git -b gh-pages /etc/clash-meta/ui
```

Make sure you have external-ui directory set correctly in your config file

```yaml
external-ui: /etc/clash-meta/ui
```

> Update

```shell
git -C /etc/clash-meta/ui pull
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
