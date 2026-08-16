# Product

<!-- impeccable:product-schema 1 -->

## Platform and stack

Static web application: Vue 3, TypeScript, Vite, Vue Router, TanStack Vue Query, project-native UI components, and Nginx production runtime. Node is a build dependency only.

## Users

Individual developers, homelab operators, and small teams sharing one Hop management trust boundary. They need to manage one instance without learning database internals or an enterprise IAM model.

## Purpose

Provide the official graphical surface for Hop: understand instance state, manage local Catalog resources, see configuration ownership before acting, and inspect or terminate recent sessions.

## Default operating model

The backend repository's Compose stack is primary. The panel is opened at its own Origin and requests `/api/v1`; Nginx forwards only that prefix to the private Hop service. Users enter only the webpage management Token. A separately hosted remote API URL is an advanced connection option.

On OpenWrt, `luci-app-hop` serves the same panel after LuCI authentication, injects its local API path at runtime, and forwards an explicit method/path allowlist to the Hop Control API on loopback. The service/core settings remain a separate native LuCI surface.

## Capabilities

- Overview: API connection, version, Catalog counts, ownership boundary, action items, and recent sessions.
- Assets: filter, create, update, and delete local SSH/TCP targets.
- Credentials: create, rotate, and delete local target credentials without secret readback.
- Access: register existing public keys, enable/disable, and manage all/restricted/deny-all asset scopes.
- Sessions: inspect up to 100 recent records and signal an active transport.
- Settings: explain connection, same-origin proxy, Token memory, CSP, and ownership.
- Language: instant English / Simplified Chinese switch.
- Demo: explicit synthetic workspace for offline evaluation.

## Ownership contract

The real API returns `ownership: local | config` on assets, credentials, and access keys. `local` resources are editable. `config` resources are labelled as managed by `hop.yaml`, and mutation actions are absent before a form can be opened. Backend conflicts remain the final safeguard.

## Security constraints

- One Bearer Token authorizes panel management; there are no panel accounts or roles.
- Token remains in page memory and clears on refresh.
- The non-secret remote endpoint and theme preference may be kept in sessionStorage.
- Only locale may be kept in localStorage.
- `change-me` is visibly unsafe.
- Credential secrets are write-only and private keys are never generated for ingress users.
- Static assets and proxy configuration contain no deployment Token.
- Production proxy is prefix-constrained and emits CSP/security headers.
- OpenWrt proxy is LuCI-authenticated, operation-allowlisted, loopback-only, and emits the panel document with equivalent browser security headers.

## Product principles

1. Show operational state before configuration chrome.
2. Make safe actions fast and dangerous actions explicit.
3. Make ownership and secret boundaries visible before interaction.
4. Keep the headless single-YAML path complete; the panel is optional.
5. Preserve scannability on desktop and task focus on mobile.
6. Use direct, calm copy in both supported languages.

## Accessibility

Semantic HTML, keyboard operation, visible focus, reduced-motion support, non-color status labels, minimum 44px touch targets, and sufficient contrast in light and dark themes.
