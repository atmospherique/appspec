# AppSpec v10 — Specification

> Status: **v10.1.0-alpha** — pre-release. The shape is finalised; descriptions are being expanded.
> Canonical schema: [`schema.json`](./schema.json)
> Reference implementation: [Mission HUD Designer](https://github.com/missionhud/designer) (renamed from `mockingbird-lab`)

This document is the **human-readable specification** of AppSpec v10. For the machine-readable contract, see `schema.json` (JSON Schema Draft 2020-12). For the design rationale of individual decisions, see RFCs under `rfc/` once filed.

---

## 1. Overview

An **AppSpec** is a JSON document describing the canonical structure of an application's intent, design, content, and lifecycle metadata. It is independent of any specific design tool, code framework, or AI model. It is intended to be:

- **Machine-validatable** (JSON Schema Draft 2020-12 with `additionalProperties: false` on every `$def`)
- **Tool-agnostic** (no Figma-, Sketch-, React-, or SwiftUI-specific structures in the core schema)
- **AI-friendly** (AI agents read, write, mutate, and patch AppSpecs as a first-class operation)
- **Auditable** (every node carries provenance; every change is a JSON Patch with attribution)
- **Reusable** (Components, design tokens, and assets are references — change once, propagate everywhere)

### Conformance tiers

| Tier | Requires |
|---|---|
| **Core** | `$schema`, `id`, `identity`, `libraryRefs`, `screens`, `_provenance` |
| **Standard** | Core + `designTokens`, `assets`, `navigation`, `contentGuidelines`, `designDirection` |
| **Extended** | Standard + `userFlows`, `styleOverrides`, `vision`, `targetUsers`, full `_provenance` (sourceTimeline + tombstones), RFC 6902 patch lifecycle |

A valid AppSpec at any tier must validate against `schema.json`. Tiers describe which optional features the document exercises, not validation strictness.

## 2. Root structure

Every AppSpec is a JSON object with these top-level properties:

### 2.1 Required fields

| Field | Type | Description |
|---|---|---|
| `$schema` | string | Canonical schema identifier. Pattern: `^(missionhud/appspec\|mockingbird/app-spec)/v[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9]+)?$`. New writes use `missionhud/appspec`; the `mockingbird/app-spec` form is accepted on read for the lifetime of v10.x. |
| `id` | string | Project identifier. Pattern: `^proj_[a-zA-Z0-9_]+$`. |
| `identity` | object | App name, description, category, target platforms, default locale. See `$defs/Identity`. |
| `libraryRefs` | object | `{ components, icons }` — which component + icon libraries this AppSpec targets. See `$defs/LibraryRefs`. |
| `screens` | object | `{ content[], required[]?, suggested[]? }` — screens grouped by lifecycle state. |
| `_provenance` | object | W3C PROV-shaped audit envelope for the AppSpec as a whole. See `$defs/Provenance`. |

### 2.2 Optional narrative fields

| Field | Type | Description |
|---|---|---|
| `vision` | object | Free-form planning object — what the app is *for*. |
| `targetUsers` | object | Free-form planning object — who the app serves. |
| `designDirection` | object | Style + mood + image style + color palette. See `$defs/DesignDirection`. |
| `contentGuidelines` | object | Tone, preferred terms, forbidden terms. See `$defs/ContentGuidelines`. |
| `designTokens` | object | DTCG-by-reference theme. See [W3C DTCG v2025.10](https://www.designtokens.org/). |
| `userFlows[]` | array | Directed graphs of flow steps with conditional logic. See `$defs/Flow`. |
| `navigation` | object | Tab bar / drawer / stack / none + items. See `$defs/Navigation`. |
| `styleOverrides` | object | Flat path-keyed override map (per AppSpec design doc § 5.2). |
| `assets` | object | Registry of AssetRef objects keyed by `asset_<id>`. See `$defs/AssetRef`. |
| `$extensions` | object | Vendor namespace for extension fields (`com.missionhud.*`, `com.mockingbird.*` for legacy data, etc.). |
| `_meta` | object | Reserved for migration metadata; producers should treat as opaque. |

## 3. Component instances

The `screens.content[]` array contains `Screen` objects, each carrying a flat `components[]` array of `ComponentInstance` objects.

A **ComponentInstance**:

| Field | Type | Description |
|---|---|---|
| `id` | string | Pattern: `^comp_[a-zA-Z0-9_]+$`. |
| `componentRef` | string | Library-qualified component reference. Pattern: `^[a-z0-9-]+/[A-Za-z0-9_]+$`. Example: `missionhud-default/HeroCard`. |
| `properties` | object | Text + boolean + instance-swap values. Property meaning is defined by the component's library descriptor. |
| `variant` | object | Variant-property selections (e.g., `{ layout: "fullBleed", style: "primary" }`). Optional. |
| `layout` | object | Figma Auto Layout block (mode, sizing, alignment, gap, padding). See `$defs/LayoutBlock`. Optional. |
| `items` | array | For repeating sections. Each item is either a property bag or a nested ComponentInstance. Optional. |
| `repeat` | boolean | Hints that `items[]` should iterate vs. render once. Optional. |
| `styleOverrides` | object | Component-local style override map. Optional. |
| `_provenance` | object | Required. Per-node audit envelope. |

### 3.1 Slug resolution

Bare slugs (`HeroCard` instead of `missionhud-default/HeroCard`) are NOT valid in a stored AppSpec — schema validation rejects them. Producers SHOULD expand bare slugs to qualified form at the producer boundary, using the AppSpec's `libraryRefs.components` as the default library. The reference implementation includes an `expandSlugs` pre-validation pass.

### 3.2 Multi-library composition

A single AppSpec can reference components from multiple libraries via fully-qualified `componentRef` strings:

- `missionhud-default/HeroCard` (Mission HUD's default library)
- `ios-18/NavigationBar` (Apple iOS 18 UI Kit adapter, when available)
- `material-3/FilledButton` (Material 3 adapter, when available)
- `shadcn-ui/Button` (community shadcn adapter, when contributed)

The `libraryRefs.components` field names the *primary* library — used for slug expansion and as the default library when an instance doesn't specify. Other library references are valid as long as the qualified ref resolves.

## 4. Design tokens

The `designTokens` object follows the [W3C Design Tokens Format Module v2025.10](https://www.designtokens.org/tr/drafts/format/) (DTCG). Tokens use the `$value` + `$type` shape and support references via `{group.token}` notation:

```json
"designTokens": {
  "color": {
    "primary": { "$value": "#0066CC", "$type": "color" },
    "primary-hover": { "$value": "{color.primary}", "$type": "color" }
  }
}
```

Mode/theme axes (light/dark, density, brand) use the DTCG Resolver Module pattern. Mission HUD's reference implementation uses `$extensions.com.missionhud.modes` for backwards-compatible mode information.

Tokens are **by reference everywhere**: component property values that resolve to tokens should use the `{group.token}` syntax, not embed literal values. This is what makes brand updates propagate without manual rewrites.

## 5. Provenance and audit trail

Every Screen, ComponentInstance, and AssetRef carries a `_provenance` envelope:

```json
"_provenance": {
  "createdBy": "mockingbird-ai",
  "createdAt": "2026-05-21T00:00:00.000Z",
  "lastEditedBy": "human-edit",
  "lastEditedAt": "2026-05-21T11:30:00.000Z",
  "figmaNodeId": "1234:5678",
  "figmaNodeIdHistory": ["1111:2222", "1234:5678"],
  "mhbId": null,
  "mhbIdHistory": [],
  "sourceTimeline": [
    { "source": "mockingbird-ai", "at": "2026-05-21T00:00:00.000Z", "note": "Initial generation" },
    { "source": "human-edit", "at": "2026-05-21T11:30:00.000Z", "note": "Title copy edit" }
  ],
  "_tombstone": null
}
```

Valid `source` values: `human-edit`, `figma-import`, `mhb-push`, `mockingbird-ai`, `preset-load`, `unknown`.

The shape is intentionally compatible with [W3C PROV](https://www.w3.org/TR/prov-overview/) so it can be ingested by external compliance / audit tools. Future v10.x minor versions will tighten the alignment.

## 6. Patch lifecycle

Changes to an AppSpec are proposed as [JSON Patch RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902) documents:

```json
{
  "patch_id": "patch_abc123",
  "project_id": "proj_example_001",
  "based_on": "v_2026-05-21T11-30-00-000Z",
  "operations": [
    { "op": "replace", "path": "/screens/content/0/components/0/properties/title", "value": "New title" }
  ],
  "proposed_by": "mockingbird-ai",
  "proposed_at": "2026-05-21T12:00:00.000Z",
  "proposed_note": "AI suggested a more concise title",
  "auto_applicable": true
}
```

Lifecycle: **proposed → applied | rejected**. Optimistic concurrency on `based_on` (the patch's source version must match the project's current version at apply time). Post-apply, the spec is re-validated and re-linted; failures auto-reject the patch.

The reference implementation ships an auto-apply heuristic (≤3 operations, non-destructive, from a trusted source) and per-node provenance touching on apply (mutated nodes' `lastEditedAt` + `sourceTimeline` bump automatically).

## 7. Extensions

The `$extensions` object lets vendors namespace their metadata without polluting the core schema:

```json
"$extensions": {
  "com.missionhud": { "originMissionId": "msn_abc", "anchors": [...] },
  "com.mockingbird": { "_meta": {...} },  // legacy data carried over from rename
  "com.example-adapter": { "internalCacheKey": "..." }
}
```

Use reverse-DNS namespaces. Mission HUD's own extensions live under `com.missionhud`. Pre-rename data carried legacy under `com.mockingbird`.

The core schema validators do not inspect `$extensions` content — vendors are responsible for their own validation if needed.

## 8. Versioning

See [`GOVERNANCE.md`](../../GOVERNANCE.md) § 3 for the full versioning policy. The short version:

- **Semver**: MAJOR (breaking) / MINOR (additive) / PATCH (clarifying)
- **Major versions ≥18 months apart** after v10's first stable release
- **Forever Backwards Read**: any v10 reader will read any future v10.x document
- **Identifier transition**: `missionhud/appspec/v10.x` is canonical; `mockingbird/app-spec/v10.x` accepted on read for the lifetime of v10.x

## 9. Examples

See `examples/` for canonical example AppSpecs. Pre-v10.1.0:

- `minimal-mobile.json` — Core conformance tier, single screen, single component

More examples covering Standard + Extended tiers ship with v10.1.0:

- `ecommerce.json` — multi-screen flow, navigation, assets, content guidelines
- `with-flows.json` — full `userFlows[]` with conditional steps
- `multi-library.json` — components from multiple library references
- `with-overrides.json` — `styleOverrides` exercised across components
- `localized.json` — content guidelines with language alternates

## 10. What's not in scope

To stay honest about what AppSpec v10 does NOT commit to:

- **Real-time multi-user collaboration semantics** — single-user-per-project for v10; multi-user is a future schema version
- **Code generation rules** — AppSpec describes what an app *is*; tools that compile it to React / SwiftUI / Compose define their own rules
- **Animation behaviour** — animation *assets* (Lottie, GIF, video) are in scope; *when* and *how* they animate is code-layer
- **Localised content per node** — only `Identity.defaultLocale` is locale-aware in v10
- **3D / AR / VR primitives** — out of scope for v10
- **Audio behaviour and synchronisation** — audio assets are technically supported but treat as experimental
- **Cross-project shared component libraries** beyond `libraryRefs` — no "this AppSpec extends another AppSpec"

---

*This is the v10.1.0-alpha cut of the spec. Expect substantive expansion of §§ 3, 4, and 5 prior to v10.1.0 stable. RFC process for additions/changes is in `GOVERNANCE.md` § 2.*
