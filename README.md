# metacubexd

CF pages: https://metacubexd.pages.dev

GH pages: https://metacubex.github.io/metacubexd

Clash-Meta Dashboard

![preview](docs/preview.webp)

## Usage

### Build locally

Install npm dependencies

```shell
pnpm install
```

Build artifacts

```shell
pnpm build
```

Serve static files

```shell
pnpm preview
```

### Run inside Docker

docker cli

```shell
docker run -d --restart always -p 80:80 --name metacubexd ghcr.io/metacubex/metacubexd
```

docker-compose.yml

```yaml
version: '3'

services:
  metacubexd:
    container_name: metacubexd
    image: ghcr.io/metacubex/metacubexd
    restart: always
    ports:
      - 80:80
```
