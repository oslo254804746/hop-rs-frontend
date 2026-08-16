---
version: 1
slug: "src-app-vue"
primary_target: "src/App.vue"
related_targets: [".impeccable/mocks/overview-operations-rail.png",".impeccable/mocks/assets-resource-workspace.png"]
---

# Hop management workspace

- Mode: Operate.
- Audience: individual developers, homelab operators, and small teams managing one Hop instance.
- Job: establish instance/Catalog state, locate one resource or trust record, understand API capability and secret boundaries, complete a safe action.
- Primary task: navigate from the global operational shell into the asset or host-trust ledger, inspect exact state, and take a guarded action.
- Proof/content: real `/api/v1` data or explicitly labeled Demo data; never infer health, ownership, audit events, or host-key state absent from the transport.
- Constraints: static output, Bearer token held in memory, responsive keyboard-accessible UI, no accounts/RBAC, no backend-hosted assets.

## Chosen direction

The shared shell leads into compact operational ledgers. Assets retain the URL-backed master-detail workspace. Host trust extends the same ledger grammar with exact hostname, port, key algorithm, complete SHA256 fingerprint, inventory matches, and an explicitly confirmed destructive reset. On mobile both ledgers preserve full facts without horizontal scrolling, while Host trust remains in More as a secondary route.

Approved comps:

- Global shell: `.impeccable/mocks/overview-operations-rail.png`
- Assets: `.impeccable/mocks/assets-resource-workspace.png`

FORM provenance key: `approved-comp/overview-operations-rail+assets-resource-workspace`. The adjacent JSON records carry the user's explicit approval decisions and point to the exact prompt files that seeded this established visual direction; Host trust extends that approved world rather than introducing a new seed.

## Fidelity inventory

| Ingredient | Commitment | Medium |
| --- | --- | --- |
| Global navigation | Seven routes, connection card, 224px → 76px → bottom dock | Semantic HTML + Lucide icons |
| Status spine | API connected, version, Catalog revision, derived active/recent session count | HTML/CSS; no fake asset health |
| Overview composition | Asymmetric operations area, factual resource counts, recent sessions, config problems | HTML/CSS |
| Assets workspace | Context filters, compact inventory, URL-backed selected row, 320px inspector | HTML/CSS + router state |
| Host trust workspace | Searchable trust ledger, exact fingerprint detail, matching assets, guarded reset | HTML/CSS + ConfirmDialog |
| Component grammar | 10–12px panels, 8px controls, 1px seams, matte elevation, 48–64px rows | CSS tokens |
| Type | Compact workhorse system UI, tabular operational numbers, mono only for identifiers | CSS font stacks |
| State | Mint connected/trusted, amber verification warning, red destructive/failure, text+icon labels | HTML/CSS |

## Product gaps

The real API does not expose asset health, audit events, connection tests, secret reveal, or a candidate replacement fingerprint after a mismatch. These appear only where the transport truly provides them. The OpenWrt build uses the shipped LuCI-authenticated loopback proxy and keeps service/core settings in the native LuCI surface.
