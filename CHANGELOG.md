# Changelog

All notable changes to AppSpec will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Schema versions are tracked separately from release versions: a v10.x release may publish updated tooling without changing the schema, in which case `SCHEMA_VERSION` (in the schema metadata) stays at `10.0.0`.

---

## [Unreleased]

### Planned for v10.1.0 stable

- Reference adapter for Figma round-trip
- Reference adapter for React + DTCG → Tailwind theme generation
- Conformance test suite (Core tier first; Standard + Extended in v10.2)
- npm publish (the package code exists; not yet `npm publish`ed)

---

## [10.1.0-alpha.2] — 2026-05-21 (CLI + family-context schema additions)

Seventh package shipped and schema additions for Mission HUD family integration.

### Added

- `@missionhud/appspec-cli` — `appspec` command-line tool with `validate`, `lint`, `check`, `migrate`, `info` commands. Colored output, proper exit codes for CI, programmatic API for embedding.

### Schema additions (additive, backwards-compatible — schema version stays 10.0.0)

- **Root `originMissionId`** (optional, pattern `^msn_[a-zA-Z0-9_]+$`) — identifier of the Mission this AppSpec was originally created for. Mission HUD family integration; standalone use can omit.
- **Root `relevantMissions[]`** (optional, array of mission ids) — enables many-to-many association so a curated AppSpec built for one Mission can be referenced by others without duplication.
- **`Provenance.sourceTimeline[].actorId`** (optional) — PROV-aligned specific-actor identifier (e.g. `user:brad@atmospherique.com` or `agent:opus-4.7/session-abc123`). Enables W3C PROV `wasAttributedTo` to point at a specific entity, not just the source category.
- **`sourceTimeline` description** explicitly documents the PROV mapping: source → `wasAssociatedWith`, actorId → `wasAttributedTo`, at → `atTime`, note → `value`. Consumers can mechanically transform sourceTimeline into PROV-N via the documented mapping.

These are purely additive; existing v10.0.0 specs remain valid. The schema version metadata stays at `10.0.0` per the convention that only contract-breaking changes bump the schema version (additive optional fields don't qualify).

### Tested

- All 7 packages compose and validate end-to-end
- CLI: validate, lint, check, migrate, info all working with correct exit codes
- New schema fields validate; invalid mission-id pattern rejected
- Existing minimal-mobile.json example still validates

---

## [10.1.0-alpha.1] — 2026-05-21 (npm packages — 6 of 7)

Monorepo scaffolded; six packages extracted from the Mission HUD Designer reference implementation. Pure functions only — no database / Postgres / Supabase coupling in any package. Each is independently consumable.

### Packages added

| Package | Description | Runtime deps |
|---|---|---|
| `@missionhud/appspec-core` | Canonical schema + identifier helpers (`SCHEMA_ID`, `LEGACY_SCHEMA_ID`, `isV10SchemaId`) | none |
| `@missionhud/appspec-provenance` | W3C PROV-shaped envelope helpers (`createProvenance`, `touchProvenance`, `generateId`, `markTombstone`, etc.) | none (uses `node:crypto`) |
| `@missionhud/appspec-validate` | Ajv-backed validator + slug expansion | core, ajv, ajv-formats |
| `@missionhud/appspec-lint` | Cross-reference integrity (flow→screen, asset, token, orphans, a11y) | none |
| `@missionhud/appspec-migrate` | v9 → v10 migration helper | core, provenance, validate |
| `@missionhud/appspec-patch` | RFC 6902 helpers + auto-apply heuristic + per-node provenance touch | provenance, fast-json-patch |

### Tooling

- npm workspaces at the repo root
- `scripts/sync-schema.js` keeps `packages/{core,validate}/schema.json` in sync with the canonical `spec/v10/schema.json` (run with `--check` in CI for drift detection)

### Smoke-tested

All 6 packages compose: validate clean, lint clean, patch applies + bumps per-node provenance correctly (touchedNodes returned), migrate v9→v10 with `_meta.anchors` moved into `$extensions['com.mockingbird']`, legacy `mockingbird/app-spec/v10.x` schema id still validates (Forever Backwards Read commitment in action).

### Notes

- These packages aren't published to npm yet (`npm publish` not run). Consumers should depend via `file:` or `link:` for now; the public `npm install @missionhud/appspec-core` lands with v10.1.0 stable.
- The patch package deliberately excludes the productized store-coupled lifecycle (Postgres-backed `proposePatch`/`applyPatch` with version concurrency). Those stay in the Mission HUD Designer codebase as the reference pattern. Open-source consumers build their own lifecycle on top of these pure helpers.

---

## [10.1.0-alpha.0] — 2026-05-21

Initial pre-release. Repository created at `github.com/missionhud/appspec`. Schema extracted from the Mission HUD Designer reference implementation (formerly Mockingbird Lab). Pre-launch posture: rapid iteration; semantics of `spec/v10/` are intended-stable; everything else is exploratory.

### Added

- `spec/v10/schema.json` — canonical JSON Schema (Draft 2020-12), schema version `10.0.0`
- `spec/v10/spec.md` — human-readable specification (initial draft; expanding through alpha)
- `README.md` — project orientation
- `LICENSE-CC-BY-4.0` (CC-BY 4.0) — specification document license
- `LICENSE-MIT` (MIT) — reference implementation code license
- `GOVERNANCE.md` — RFC process, maintainership, migration path
- `CONTRIBUTING.md` — issue + PR contribution workflow

### Schema highlights

- Identity, vision, target users, design direction, content guidelines — narrative metadata
- `libraryRefs` — pluggable component + icon library references
- `designTokens` — DTCG by reference (W3C Design Tokens v2025.10)
- `screens.content[]` — flat list of Component instances per screen
- `screens.required[]` + `suggested[]` — planning hint lists
- `userFlows[]` — directed graphs of flow steps with conditional logic
- `navigation` — tab bar / drawer / stack / none + items
- `assets` — registry of image / vector / lottie / video / video-embed / font / audio
- `_provenance` — W3C PROV-shaped audit envelope on every node (createdBy, lastEditedBy, sourceTimeline, figmaNodeIdHistory, mhbIdHistory, tombstones)
- `$extensions` — vendor namespace for extension fields (`com.missionhud.*` etc.)

### Identifier note (back-compat)

Specs in the wild from the pre-rename reference implementation carry `$schema: "mockingbird/app-spec/v10.0.0"`. The schema pattern accepts both that legacy form and the canonical `missionhud/appspec/v10.0.0` for `v10.x` reads. New writes emit the canonical form. See [Forever Backwards Read](GOVERNANCE.md#versioning).

---

*Pre-`v10.1.0-alpha.0` history lived inside the Mission HUD Designer reference implementation (Mockingbird Lab) and is preserved in that codebase. From this entry forward, the schema is canonical here.*
