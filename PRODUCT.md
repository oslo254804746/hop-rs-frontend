# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vue 3 + TypeScript + Vite, confirmed by the user. Vue Router owns navigation and TanStack Vue Query owns Control API server state. The interface uses a small project-native component and token layer rather than a large UI framework. Production output must be static and require no Node.js runtime.

## Users

Primary users are individual developers, homelab operators, and small teams that share one management trust boundary. They manage one lightweight Hop instance from Linux, Docker, or OpenWrt and need a fast way to understand status, configure access, and resolve operational problems without learning an enterprise IAM model.

## Product Purpose

Provide the missing graphical management surface for Hop v0.2. A user should be able to connect one Hop instance, understand whether it is healthy, manage local Catalog resources, inspect declarative ownership, and terminate an active session without using raw API calls.

Success means the interface shortens routine Hop administration while preserving the headless core, the single management trust domain, and the same Catalog semantics used by the CLI and manifests.

## Positioning

Hop's panel is an optional, independently delivered control surface over the versioned `/api/v1` contract. It is not an identity product and does not recreate the removed Admin Web account, session, role, or capability system. The distinguishing mechanism is that every management entry point—panel, CLI, and manifest—operates on the same lightweight Catalog with explicit ownership and secret boundaries.

## Operating Context

- Operators work with SSH assets, generic TCP assets, target credentials, ingress Access Keys, key-to-asset allowlists, recent sessions, and declarative configuration sources.
- Hop itself commonly runs unattended on a small Linux server, in Docker, or on an OpenWrt router.
- The standalone panel connects directly to a user-supplied Hop Control API endpoint with one Bearer Token.
- A later `luci-app-hop` transport will reuse the product model while keeping the token behind a LuCI ACL-protected rpcd proxy.
- The first repository is `/home/oslo/projects/hop-rs-frontend`; the backend contract is in `/home/oslo/projects/hop-rs`.

## Capabilities and Constraints

- Overview: instance health, version, Catalog revision, resource totals, active/recent sessions, and configuration-source problems.
- Assets: list, filter, create, update, and delete local `ssh` and `tcp` assets.
- Credentials: create, rotate, and delete SSH credentials; existing secret values are never returned or displayed.
- Access: add, enable, disable, and delete ingress keys; manage all, restricted, and empty allowlists.
- Sessions: inspect recent sessions and explicitly terminate an active registered session.
- Configuration: inspect sources and orphans; validate, diff, apply, and reload with revision-conflict handling.
- Declarative resources remain visibly owned by their source and cannot be silently taken over or edited as local resources.
- The standalone panel stores its management token only for the current browser session and never persists it in local storage.
- The first implementation must remain useful without a live Hop instance through clearly labeled synthetic demo data.
- The core does not host panel assets. Static output is a separate release artifact.
- The public product/package name for the standalone panel is still undecided; the interface uses the Hop name in the meantime.

## Brand Commitments

- Product name: Hop.
- Voice: direct, calm, compact, and operational; no enterprise-security theater or promotional dashboard language.
- Visual reference: [Zashboard](https://github.com/Zephyruso/zashboard), specifically its compact navigation, low-noise surfaces, clear status encoding, and responsive desktop/mobile transformation. Hop must not copy Mihomo-specific content, icons, or information architecture.
- The requested direction is simple and restrained rather than decorative.

## Evidence on Hand

- `/home/oslo/projects/hop-rs/docs/product/management-panel-v0.2.md`: confirmed delivery, scope, and security boundary.
- `/home/oslo/projects/hop-rs/docs/product/product-direction-v0.2.md`: active product direction.
- `/home/oslo/projects/hop-rs/docs/admin-guide.md`: current Control API resource and mutation contract.
- `/home/oslo/projects/hop-rs/crates/hop-server/src/control_api.rs`: implemented routes and response behavior.
- Zashboard desktop and mobile screenshots plus source are available from its public repository as visual reference only.
- No final Hop panel logo, bespoke icon set, customer data, benchmarks, or production screenshots have been provided; the build must not fabricate them.

## Product Principles

1. Show operational state before configuration chrome.
2. Make safe actions fast and destructive or ownership-conflicting actions unmistakable.
3. Keep the Catalog model visible instead of hiding ownership, secret, or revision semantics.
4. Preserve a complete headless path; the panel is optional and replaceable.
5. Let dense information remain scannable on desktop and task-focused on mobile.

## Accessibility & Inclusion

Use semantic HTML, complete keyboard operation, visible focus, reduced-motion support, non-color status labels, and contrast suitable for extended operational use in both light and dark environments.
