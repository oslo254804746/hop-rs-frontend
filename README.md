# Hop management panel

The official static web panel for Hop. The recommended production path is the backend repository's pull-only `compose.yaml`: the browser opens the panel and calls same-origin `/api/v1`, while Hop's port 8083 stays private to the Compose network.

## Production with Hop

No frontend checkout or local build is required. From the backend deployment files:

```bash
cp examples/panel-first.yaml hop.yaml
# Replace api.token: change-me in hop.yaml.
chmod 0600 hop.yaml
docker compose pull
docker compose up -d
```

Open `http://localhost:8080` and enter the webpage management Token. The default flow never asks for an API URL. A separate remote Control API URL is available only in the advanced “Connect to another instance” section.

## What is included

- Overview, SSH/TCP assets, target credentials, ingress public keys, and sessions.
- Local resource create/update/delete and active-session termination.
- Minimal `local`/`config` ownership: local resources are editable; `hop.yaml` resources are labelled read-only before action buttons render.
- A focused Settings page for connection, Token, same-origin proxy, CSP, and ownership boundaries.
- English / 简体中文 switching with the language preference persisted.
- A clearly labelled synthetic Demo workspace for product evaluation.
- Responsive desktop and mobile navigation, dark/light themes, keyboard focus, and reduced motion.

Secret values are write-only. Stored credential material and ingress private keys are never read or displayed.

## Connection security

- The management Token is held only in JavaScript memory. It is not stored in localStorage, sessionStorage, Vue Query persistence, Nginx configuration, logs, or the build output.
- Refreshing the page clears the Token and requires re-authentication.
- `change-me` works for first use but produces a visible warning and must be replaced.
- The production Nginx configuration proxies exactly `/api/v1` to `http://hop:8083`, returns 404 for other `/api` paths, applies SPA fallback elsewhere, and sends a restrictive CSP and security headers.
- A remote cross-origin URL is an advanced deployment and should use HTTPS plus an explicit backend Origin configuration.

## Development

Requirements: Node.js `^20.19.0` or `>=22.12.0`, npm 10+.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. The app starts at the authentication dialog; choose “Use demo data” when no backend is available.

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
npm run test:container
```

The production container smoke test builds both repositories and verifies `/`, an SPA deep link, `/api/v1/status` 401/200 behavior, Bearer forwarding, rejection of an unknown API path, upstream failure, and that backend port 8083 is not published.

## Container image

`Dockerfile` uses Node only in the build stage and `nginx:alpine` at runtime. Matching version tags are published as `ghcr.io/oslo254804746/hop-rs-frontend:<tag>` and paired with the Hop backend through `HOP_VERSION`.

## Documents

- [Product baseline](PRODUCT.md)
- [Design specification](docs/design-spec.md)
- [Implementation record](docs/implementation-plan.md)
- [Shipped visual system](DESIGN.md)
