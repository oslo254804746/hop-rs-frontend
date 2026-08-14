# Hop management panel

An independent web interface for the Hop v0.2 Control API. It manages one Hop instance through `/api/v1` and keeps the headless core, CLI, manifests, and Catalog semantics intact.

The panel currently uses the working name **Hop**. It is a separate static artifact; `hop-rs` does not embed or serve this repository.

## What is included

- Operational overview with API status, version, Catalog revision, resource totals, recent sessions, source errors, and orphans.
- SSH/TCP asset inventory with responsive master-detail management.
- Credential create/rotate/delete flows that never read existing secret material.
- Access Key enable/disable, all/restricted/empty asset scopes, and revoke flows.
- Recent sessions with explicit active-session termination.
- Manifest validate, diff, apply, and configured-source reload workflows.
- Stateful, clearly labeled Demo transport for development and product evaluation.
- Dark/light themes and desktop, tablet, and mobile navigation.

The real Control API does not currently expose ownership metadata, asset health, audit events, connection tests, or private Access Key material. The interface does not infer or fabricate these capabilities. See [the design specification](docs/design-spec.md) for the complete boundary.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm 10+
- A Hop v0.2 instance only when testing real mode; Demo mode works without a backend

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. The app starts in Demo mode unless the current browser session remembers an instance URL that needs re-authentication.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

## Connecting a Hop instance

1. Enable the Hop Control API and its single management token.
2. Open **Instance** in the panel.
3. Enter either the Hop origin, such as `http://127.0.0.1:8083`, or a base ending in `/api/v1`.
4. Enter the Bearer management token.

The endpoint is stored only in `sessionStorage`. The token is held only in JavaScript memory: it is not written to `localStorage`, `sessionStorage`, Vue Query persistence, logs, or build output. Reloading the page requires the token again.

Every API route requires `Authorization: Bearer <token>`. A browser connecting across origins also requires that exact panel origin in Hop's CORS allowlist. For remote access, place both services behind HTTPS or a controlled same-origin reverse proxy; CORS is not a security boundary.

## Production build

```bash
npm ci
npm run build
```

Deploy the generated `dist/` directory with any static server. Configure SPA fallback so unknown paths return `index.html`. No Node.js runtime is required after the build.

A common production layout serves the panel at one HTTPS origin and narrowly proxies only `/api/v1` to Hop. Do not create a general-purpose proxy and do not expose an unencrypted management token over a remote network.

## Repository documents

- [Product baseline](PRODUCT.md)
- [Design specification](docs/design-spec.md)
- [Implementation plan](docs/implementation-plan.md)
- [Shipped design system](DESIGN.md), generated from the finished interface after visual review rather than from pre-build intent.

## Backend contract

The implementation source of truth lives in the sibling backend repository:

- `/home/oslo/projects/hop-rs/crates/hop-server/src/control_api.rs`
- `/home/oslo/projects/hop-rs/docs/admin-guide.md`
- `/home/oslo/projects/hop-rs/docs/product/management-panel-v0.2.md`
