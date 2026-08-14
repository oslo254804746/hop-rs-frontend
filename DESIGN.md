---
name: Hop Management Workspace
description: A compact operational Catalog surface built from matte blue-charcoal layers, hairline seams, and restrained mint state.
colors:
  canvas: "#0d141d"
  rail: "#111b27"
  panel: "#172231"
  raised: "#1c2939"
  input: "#121c28"
  hover: "#213044"
  selected: "#26384b"
  seam: "#2a394b"
  seam-strong: "#3b4d61"
  ink-strong: "#edf3f7"
  ink: "#c2ccd6"
  ink-muted: "#8795a5"
  mint: "#53c7a2"
  mint-strong: "#76d7b7"
  mint-soft: "#183c37"
  mint-ink: "#07150f"
  warning: "#f2b84b"
  warning-soft: "#3c3120"
  danger: "#f26464"
  danger-soft: "#3d2228"
  danger-ink: "#190809"
  info: "#71b7f4"
  info-soft: "#1c3247"
  focus: "#8ccaff"
  light-canvas: "#edf1f4"
  light-rail: "#f7f9fa"
  light-panel: "#ffffff"
  light-raised: "#f7f9fb"
  light-input: "#f2f5f7"
  light-hover: "#e7edf1"
  light-selected: "#dfe9ed"
  light-seam: "#d3dce2"
  light-seam-strong: "#b7c5cf"
  light-ink-strong: "#15212c"
  light-ink: "#354656"
  light-ink-muted: "#687987"
  light-mint: "#147d68"
  light-mint-strong: "#086a58"
  light-mint-soft: "#d9f0e9"
  light-warning: "#9b6713"
  light-warning-soft: "#faecd3"
  light-danger: "#b83b45"
  light-danger-soft: "#f8e1e4"
  light-info: "#276f9f"
  light-info-soft: "#dcecf7"
  light-focus: "#136fa7"
typography:
  micro:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "10px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.06em"
  metadata:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "0.04em"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "normal"
  compact-body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  button-label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "normal"
  supporting-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  section-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 620
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  inspector-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "normal"
  emphasis:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "normal"
  shell-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 590
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 620
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  page-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(20px, 2vw, 24px)"
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  mono:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
rounded:
  none: "0"
  marker: "2px"
  compact: "7px"
  control: "8px"
  inset: "9px"
  status: "10px"
  panel: "12px"
  dialog: "14px"
  sheet: "16px"
  pill: "999px"
spacing:
  hairline: "1px"
  xxs: "3px"
  xs: "4px"
  compact: "6px"
  sm: "8px"
  control: "10px"
  md: "12px"
  inline: "14px"
  gutter-min: "16px"
  large: "20px"
  xl: "24px"
  gutter-max: "28px"
  xxl: "32px"
  content-gutter: "clamp(16px, 2vw, 28px)"
components:
  button-primary:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.mint-ink}"
    typography: "{typography.button-label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink-strong}"
    typography: "{typography.button-label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.button-label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.input}"
    textColor: "{colors.ink-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  status-badge:
    backgroundColor: "{colors.mint-soft}"
    textColor: "{colors.mint-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    height: "28px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  navigation-item:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "46px"
  asset-row:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "59px"
---

# Design System: Hop Management Workspace

## Overview

**Creative North Star: "The Operational Ledger"**

Hop is one calm control surface: a matte blue-charcoal shell that puts instance state, Catalog records, ownership, and safe action into a continuous operational workspace. It should feel like a well-kept systems ledger rather than a generic metrics dashboard—compact, factual, low-glare, and easy to scan for long sessions.

Brand character comes from precision: hairline seams, restrained mint, workhorse typography, tabular operational values, and a selected row that joins the inventory to a persistent inspector. Light mode changes contrast, not hierarchy or semantics. The interface avoids gradients, translucent glass surfaces, display-scale typography, and decorative effects that compete with the data.

**Key Characteristics:**

- Matte graphite and blue-charcoal layers with a matched light theme.
- One restrained mint accent for connection, selection, and safe primary action.
- Compact tables, 42–44px controls, and 54–59px operational rows.
- Hairline seams and tonal layering before shadows.
- Desktop rail and inspector transform into a bottom dock and URL-driven full-screen mobile detail.
- Status always uses text and icon in addition to color.

## Colors

The palette is a low-glare blue-charcoal neutral field with mint operational state, amber warning, red failure or destructive action, and blue informational guidance. The dark theme is the default; every light token is a semantic counterpart, not a new palette.

### Primary

- **Operational Mint** (`mint`, `mint-strong`, `mint-soft`): connection state, safe primary actions, selected-row seams, configured credentials, and other affirmative operational state; `mint-ink` is the dark foreground on a solid mint action.
- **Light Operational Mint** (`light-mint`, `light-mint-strong`, `light-mint-soft`): the same roles in light mode with contrast-adjusted values.

### Secondary

- **Caution Amber** (`warning`, `warning-soft`; light counterparts prefixed `light-`): source problems, missing credentials, re-authentication, and other conditions that require attention without implying failure.
- **Destructive Coral** (`danger`, `danger-soft`; light counterparts prefixed `light-`): destructive actions, rejected or failed state, validation errors, and irreversible confirmation; `danger-ink` is the dark foreground on a solid destructive button.

### Tertiary

- **Guidance Blue** (`info`, `info-soft`, `focus`; light counterparts prefixed `light-`): contextual information, navigational links, and the visible keyboard focus channel.

### Neutral

- **Canvas, Rail, Panel, Raised, and Input** (`canvas`, `rail`, `panel`, `raised`, `input`): the five dark matte layers, from the page ground through controls.
- **Hover and Selected** (`hover`, `selected`): quiet interaction layers that remain visibly distinct from both the canvas and panels.
- **Seam and Strong Seam** (`seam`, `seam-strong`): the hairline divider and higher-contrast boundary vocabulary.
- **Strong Ink, Ink, and Muted Ink** (`ink-strong`, `ink`, `ink-muted`): headings and values, ordinary copy, then labels and secondary metadata.
- **Light Neutral Counterparts** (the `light-` prefixed surface, seam, and ink tokens): preserve the same order of prominence in light mode.

**The Signal Budget Rule.** Mint marks connected, selected, configured, or safely actionable state; amber marks attention; red is reserved for failure and destructive outcomes; blue carries guidance and focus. Never invent a status the transport does not provide merely to add color.

## Typography

**Interface Font:** the native system sans stack, with Segoe UI and generic sans fallbacks.

**Identifier Font:** SFMono-Regular, Consolas, Liberation Mono, then generic monospace.

**Character:** The system uses compact workhorse type with modest negative tracking only on titles. It has no separate display face or oversized display tier; hierarchy comes from weight, muted color, case, and spatial placement. Operational numbers use tabular figures, and mono is limited to identifiers, addresses, hashes, revisions, and machine-facing values.

### Hierarchy

- **Page title** (620, 20–24px fluid, 1.2): route introductions only.
- **Headline and shell title** (590–620, 19–20px, 1.25): status leads, the top bar, and major local headings.
- **Section and inspector title** (620–650, 16–17px, 1.35): panels and selected-resource detail.
- **Body and controls** (400–650, 13–15px, 1–1.5): table values, supporting copy, fields, and button labels.
- **Label and metadata** (650, 10–12px, 1.2–1.25): table headers and operational micro-labels; uppercase labels use 0.04–0.06em tracking.
- **Mono** (400, 14px, 1.5): identifiers and tabular machine values, never prose.

**The Workhorse Type Rule.** Keep information-bearing text on the documented 10–24px ramp, reserve the 10px step for short micro-labels, and do not introduce display typography or decorative font pairings.

## Layout

The global shell uses a fixed 224px navigation rail, a sticky 68px top bar, and a content gutter that grows from 16px to 28px. Primary page stacks and asymmetric overview columns use a 12px rhythm; panels are separated by visible seams rather than generous whitespace. Controls are 42–44px high, summary rows are commonly 50–54px, and inventory rows are 59px so dense information remains operable.

At 900–1535px the rail compresses to 76px and removes text labels while retaining every route. Below 900px the rail disappears, the top bar becomes 58px, the main gutter becomes 12px, and a five-position bottom dock occupies at least 64px plus the safe-area inset. The dock exposes Overview, Assets, Access, Sessions, and More; Credentials and Configuration move into the More sheet.

The Assets workspace is a master-detail grid: 190px context filters, a flexible inventory with a 520px minimum, and a 320px inspector. At 1535px the context rail collapses into toolbar filters; at 1199px the inspector becomes a fixed 380px overlay; below 900px selection hides the inventory and opens a URL-driven detail surface from the top bar to the bottom dock. The compact mobile inventory replaces table headers with two-column rows. On the overview, two asymmetric columns stack at 1199px and the four-resource strip becomes two columns at 760px.

**The Shell Transformation Rule.** Preserve navigation, state, and selection across the 224px rail, 76px rail, and mobile dock modes; responsive adaptation changes presentation, never the operator's place in the task.

## Elevation & Depth

The system is flat by default. Depth comes first from the Canvas → Rail → Panel → Raised/Input tonal sequence and 1px seams. The standard layer shadow (`0 18px 40px rgba(1, 7, 15, 0.26)` dark; `0 18px 40px rgba(31, 48, 60, 0.13)` light) is limited to transient inspectors, dialogs, and mobile sheets; destructive confirmation uses the stronger overlay shadow (`0 22px 52px rgb(0 0 0 / 0.32)`). Dark overlay backdrops may blur the obscured canvas by 3–4px, but the foreground surface remains opaque and matte.

**The Flat-by-Default Rule.** Do not shadow resting panels or rows. Introduce elevation only when a surface temporarily sits above the workspace or must preserve spatial context during a task.

## Shapes

Corners are compact and functional. Controls use an 8px radius; small framed icons use 7–9px; notices and connection cards use 10px; persistent panels and confirmation surfaces use 12px; dialogs use 14px. Mobile sheets round only their top edge at 16px. Pills use the full 999px radius, and circular geometry is reserved for status marks and dots. Every surface boundary is a 1px seam; the 2px mint selection bar is the only recurring edge emphasis.

**The Compact Geometry Rule.** Keep persistent working surfaces between 8px and 12px, reserve 14–16px for transient layers, and use pills only for compact statuses, tags, or mode badges.

## Components

Components are quiet at rest, direct in state, and sized for repeated operational use. Keyboard focus is always a 2px focus outline with a 2px offset, or an equivalent 2–3px focus halo inside fields.

### Buttons

- **Shape:** an 8px control radius, 44px minimum height, 10px × 14px padding, 14px/650 label, and optional 17px leading or trailing icon.
- **Primary:** solid Operational Mint with dark mint ink; hover mixes the accent 88% toward white.
- **Secondary:** Raised surface with Strong Ink and a Seam border; hover lifts both surface and border contrast.
- **Quiet:** transparent with ordinary Ink; hover adds a low-opacity Raised layer and promotes the label to Strong Ink.
- **Danger:** solid Destructive Coral with dark danger ink; inspector actions may use the established outlined red treatment instead.
- **Motion:** color and transform transitions run for 140ms ease; active buttons move down 1px; loading icons spin at 850ms linear. Disabled controls use 0.56 opacity and never imply clickability.

### Chips

- **Style:** 999px pills use a tone at roughly 11% background, 34% border, and high-contrast text, with a 28px minimum height and 4px × 10px padding.
- **State:** success, warning, danger, info, and neutral variants always pair a 14px icon with a text label. Tags are quieter Raised-surface pills and do not masquerade as statuses.

### Cards / Containers

- **Corner Style:** persistent panels use 12px; notices and connection cards use 10px.
- **Background:** Panel is the default, with Raised or mixed Panel/Canvas only for subordinate regions.
- **Shadow Strategy:** no resting shadow; see Elevation & Depth for overlay-only shadows.
- **Border:** one Seam line, promoted to Strong Seam for transient dialogs.
- **Internal Padding:** dense sections range from 12px to 24px; repeated data rows use seams instead of independent cards.

### Inputs / Fields

- **Style:** 44px minimum height, 8px radius, 10px × 12px padding, one Seam border, Strong Ink, and Input or Canvas background depending on containment.
- **Focus:** the border shifts to Focus/Info and gains a 2px halo at 30% of that tone; search controls use the same border shift through `focus-within`.
- **Error / Disabled:** errors replace the border and message color with Destructive Coral; hints remain Muted Ink. Secrets are never represented as revealable stored values.

### Navigation

- **Desktop rail:** navigation rows are 46px high with an 8px radius, 19px Lucide icons, Muted Ink at rest, Hover surface on hover, and Selected surface plus a 2px mint leading bar when active.
- **Top bar:** remains sticky and uses compact 42px actions; the mode badge carries explicit connection/demo text.
- **Mobile dock:** five equal columns, 54px links, 20px icons, and 10px labels. The active destination uses Selected plus Mint Strong; secondary routes live in an opaque bottom sheet.

### Asset Master-Detail

- **Inventory:** desktop rows are 59px high and align to a five-column grid with tabular addresses. Hover uses Hover; selection uses Selected plus an inset 2px mint seam.
- **Inspector:** remains 320px in the full desktop grid, becomes a 380px overlay below 1200px, and becomes a full-screen URL-driven layer below 900px.
- **Ownership:** local, declarative, unknown, and mutation-rejected ownership states use explicit copy and notices; no ownership or health state is inferred from appearance alone.

**The Durable State Rule.** Every active, selected, warning, destructive, ownership, and connection state must remain understandable without color and must survive responsive transformation.

## Do's and Don'ts

### Do:

- **Do** lead with current instance and Catalog state before configuration chrome.
- **Do** use matte semantic layers, 1px seams, and the 12px page rhythm to keep dense screens readable.
- **Do** preserve the same color meanings and prominence order in both dark and light themes.
- **Do** use tabular figures for operational counts, timestamps, durations, ports, and revisions.
- **Do** keep mobile detail URL-driven, full-screen, and bounded between the 58px top bar and the dock safe area.
- **Do** label synthetic demo facts and show only capabilities or status that the transport actually provides.

### Don't:

- **Don't** use gradients, translucent glass surfaces, ambient glow, or decorative shadows.
- **Don't** introduce large display type, ornamental font pairings, or marketing-dashboard language.
- **Don't** turn every row into a floating card; keep compact tables and seam-separated ledgers.
- **Don't** spend mint on decoration or use red for anything short of failure, validation, or destructive action.
- **Don't** fabricate ownership, asset health, audit events, connection tests, secret reveal, or other real-API capabilities.
- **Don't** collapse desktop navigation or inspectors without preserving routes, selected resource state, and keyboard access.
