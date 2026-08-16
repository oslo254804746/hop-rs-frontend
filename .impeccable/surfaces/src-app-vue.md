---
version: 1
slug: "src-app-vue"
primary_target: "src/App.vue"
related_targets: [".impeccable/mocks/overview-operations-rail.png", ".impeccable/mocks/assets-resource-workspace.png"]
---

# Hop management workspace

- Mode: Operate.
- Audience: individual developers, homelab operators, and small teams managing one Hop instance.
- Job: establish instance/Catalog state, locate one resource, understand API capability and secret boundaries, complete a safe action.
- Primary task: navigate from A's global operational shell into B's asset master-detail workspace.
- Proof/content: real `/api/v1` data or explicitly labeled Demo data; never infer health, ownership, or audit events absent from the transport.
- Constraints: static output, Bearer token held in memory, responsive keyboard-accessible UI, no accounts/RBAC, no backend-hosted assets.

## Chosen direction

A is the shared navigation/status shell; B is the Assets route only. At wide desktop B's context filters sit between A and the inventory, then collapse before they starve the table. The memorable moment is a selected catalog row joining a persistent inspector without interrupting the operator's scan. On mobile the same selection becomes a URL-backed full-screen detail layer.

Approved comps:

- Global shell: `.impeccable/mocks/overview-operations-rail.png`
- Assets: `.impeccable/mocks/assets-resource-workspace.png`

## Fidelity inventory

| Ingredient | Commitment | Medium |
| --- | --- | --- |
| Global navigation | Six routes, connection card, 224px → 72px → bottom dock | Semantic HTML + Lucide icons |
| Status spine | API connected, version, Catalog revision, derived active/recent session count | HTML/CSS; no fake asset health |
| Overview composition | Asymmetric operations area, factual resource counts, recent sessions, config problems | HTML/CSS |
| Assets workspace | Context filters, compact inventory, URL-backed selected row, 320px inspector | HTML/CSS + router state |
| Component grammar | 10–12px panels, 8px controls, 1px seams, matte elevation, 48–56px rows | CSS tokens |
| Type | Compact workhorse system UI, tabular operational numbers, mono only for identifiers | CSS font stacks |
| State | Mint connected/action, amber warning, red destructive/failure, text+icon labels | CSS + Lucide icons |

## Product gaps

The real API does not expose asset health, audit events, connection tests, or secret reveal. These appear only where the transport truly provides them. The OpenWrt build uses the shipped LuCI-authenticated loopback proxy and keeps service/core settings in the native LuCI surface.
