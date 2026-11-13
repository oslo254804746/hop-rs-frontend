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

- Overview, SSH/TCP assets (with `via` jump-host chaining and per-asset TCP forwarding controls), target credentials, scheduled **Alerts & Probes**, ingress public keys, sessions, Known Hosts trust records, and mutation/access Audit events.
- On-demand and scheduled zero-agent TCP & SSH banner reachability probing (`POST /api/v1/assets/probe`, `GET/PUT /api/v1/probe/settings`, `GET /api/v1/assets/probe-history`) with RTT latency pills and trend sparklines.
- Encrypted **Telegram Bot**, **Bark (iOS Push)**, and **HMAC-SHA256 Webhook** alert channels (`GET/POST/PUT/DELETE /api/v1/notifications/channels`) with one-click test delivery and recovery notifications.
- Zero-agent **SSH Key Bootstrap** workflow (`POST /api/v1/assets/{id}/bootstrap-key`) to onboard fresh password-based servers onto Ed25519 vault keys and optionally disable `sshd` password authentication after verified login.
- One-click `~/.ssh/config` generator supporting both **Vault Relay** (terminal, `scp`/`sftp`, `-L`/`-D` port forwarding, and Cursor / VS Code Remote-SSH without local target keys) and **ProxyJump** modes, plus row-level quick-connect command copy.
- Inline target credential creation directly inside the New Asset workflow.
- Complete target fingerprints and an explicitly confirmed trust reset for verified rebuilds or SSH Host Key rotations.
- Local resource create/update/delete and active-session termination.
- Minimal `local`/`config` ownership: local resources are editable; `hop.yaml` resources are labelled read-only before action buttons render.
- A focused Settings page for connection, SSH relay endpoint, Token, same-origin proxy, strict CSP (`style-src 'self'` with zero inline style mutations), and ownership boundaries.
- English / 简体中文 switching with locale-synced document titles and persisted language preference.
- A clearly labelled synthetic Demo workspace for product evaluation.
- Responsive desktop and mobile navigation, dark/light themes, keyboard focus (`/` asset search), and reduced motion.

Secret values are write-only. Stored credential material and ingress private keys are never read or displayed.

## Connection security

- After a successful connection, the management Token is stored in the current tab's sessionStorage so a refresh can reconnect automatically. It is not stored in localStorage, Vue Query persistence, Nginx configuration, logs, or the build output.
- Closing the tab session, choosing Demo, or explicitly requiring/forgetting the connection clears the saved Token.
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

## OpenWrt / LuCI build

The same application can be built for `luci-app-hop` without changing the
standalone Nginx deployment:

```bash
npm run build:openwrt
```

This mode emits assets under `/hop/` and uses hash routing so LuCI does not need
an SPA fallback for nested routes. The LuCI controller serves the generated
`index.html` after login, injects the authenticated API/service paths through
`hop-*` meta elements, and proxies only the documented Hop API operations to
the loopback listener. The browser still scopes the Hop management Token to the
current tab session.

From a neighbouring `luci-app-hop` checkout, synchronize the generated static
files with:

```bash
../luci-app-hop/scripts/sync-frontend.sh "$PWD"
```

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run build:openwrt
npm run test:e2e
npm run test:container
```

The production container smoke test builds both repositories and verifies `/`, an SPA deep link, `/api/v1/status` 401/200 behavior, Bearer forwarding, rejection of an unknown API path, upstream failure, and that backend port 8083 is not published.
Playwright writes its report and test artifacts below `${TMPDIR:-/tmp}/hop-rs-frontend-playwright` by default; set `PLAYWRIGHT_ARTIFACT_DIR`, `PLAYWRIGHT_OUTPUT_DIR`, or `PLAYWRIGHT_REPORT_DIR` to use another writable location.

## Container image

`Dockerfile` uses Node only in the build stage and `nginx:alpine` at runtime. Matching version tags are published as `ghcr.io/oslo254804746/hop-rs-frontend:<tag>` and paired with the Hop backend through `HOP_VERSION`.

## Documents

- [Product baseline](PRODUCT.md)
- [Design specification](docs/design-spec.md)
- [Implementation record](docs/implementation-plan.md)
- [Shipped visual system](DESIGN.md)
