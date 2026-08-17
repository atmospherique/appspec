# Changelog

All notable changes to AppSpec will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Schema versions are tracked separately from release versions: a v10.x release may publish updated tooling without changing the schema, in which case `SCHEMA_VERSION` (in the schema metadata) stays at `10.0.0`.

---

## [Unreleased]

### Added (schema, backward-compatible — RFC: typed navigations + routes)

- `Screen.route` (optional string) — a route/deep-link path for web targets and app
  deep-linking; screens without routes are reachable only by in-app navigation.
- `Screen.navigatesTo` entries may now be a **typed navigation object**
  `{ to, kind?: push | modal | replace | back | deep-link, label? }` in addition to the
  existing bare screen-id string (which keeps meaning `kind: "push"`). Every existing
  document remains valid; consumers that only understand strings can read `to` and ignore
  the rest. Motivation: screen-map tooling (canvas editors, navigation linters, route/test
  compilers) needs the navigation *kind* to be data, not convention.

### Planned for v10.1.0 stable

- More runtime renderers (`@missionhud/appspec-runtime-vue`, `-svelte`)
- Standard- and Extended-tier conformance test cases
- npm publish (the package code exists; not yet `npm publish`ed)

---

## [10.1.0-alpha.4] — 2026-05-21 (native library coverage + conformance + CI)

Broadens nativeMapping coverage across three platforms and lands the first formal conformance harness, so external implementers can self-claim compliance against a fixed set of test vectors.

### Added

- **`spec/v10/libraries/ios-18.json`** — second native library descriptor. 10 SwiftUI primitives (NavigationStack, List, Section, Text, Button, TextField, Toggle, VStack, HStack, Image) with codegen target `swiftui` and runtime target `runtime-react` (via the future `@missionhud/runtime-ios-preview-kit`).
- **`spec/v10/libraries/material-3.json`** — third native library descriptor. 10 Jetpack Compose / Material 3 primitives (Scaffold, TopAppBar, Card, Text, FilledButton, OutlinedButton, TextField, Switch, Column, Row) with codegen target `compose` and runtime target `runtime-react` (via the future `@missionhud/runtime-material-preview-kit`).
- **`spec/v10/conformance/`** — Core-tier conformance test suite. Four valid fixtures (minimal, one-screen, multi-screen, legacy schema id) and seven invalid fixtures with `.expected.json` sidecars (missing-id, missing-provenance, missing-library-icons, bad-id-pattern, bad-schema-id, bare-componentRef). Runner at `spec/v10/conformance/run.js` supports `--tier=core` and `--json` flags. Documented self-claim process in `conformance/README.md`.
- **`scripts/validate-library-descriptors.js`** — validates every `spec/v10/libraries/*.json` against `library-descriptor.schema.json` (Draft 2020-12 via Ajv2020). Wired as `npm run validate-libraries`.
- **`.github/workflows/ci.yml`** — GitHub Actions CI. Runs library validation, conformance suite, and workspace tests on every push and PR to `main`.
- **`.github/ISSUE_TEMPLATE/bug.yml`** + **`rfc.yml`** — structured issue templates. Bug template asks for area + version + reproduction; RFC template covers motivation, compatibility impact, and alternatives considered.
- **`SECURITY.md`** — coordinated disclosure policy. Scopes what counts as a security issue (validation bypass, provenance forgery, walker escape) versus a regular bug. Supported versions: v10.x current, v9.x security-only.
- Root `package.json` scripts: `validate-libraries`, `conformance`, and `ci` (composite of validate-libraries + conformance + workspace tests).

### Coverage status

| Platform | Library | Components | Codegen target | Runtime target |
|---|---|---|---|---|
| Web | shadcn-ui | 10 | `react` | `runtime-react` |
| iOS | ios-18 | 10 | `swiftui` | `runtime-react` (preview kit) |
| Android | material-3 | 10 | `compose` | `runtime-react` (preview kit) |

Conformance: 4 valid + 7 invalid = 11 Core-tier fixtures, all passing against `@missionhud/appspec-validate` reference implementation.

### Why this matters

- External implementers (anyone building their own validator, walker, or codegen pipeline) now have an objective bar to claim conformance against — not "passes our reference implementation," but "passes a fixed, versioned set of test vectors."
- Native mapping is no longer just a React story: SwiftUI and Compose entries prove the `nativeMapping` shape generalises across paradigms (imperative + declarative; flexbox + slot composition; constraint-based + linear layout).
- CI enforces every PR against the same harness, so descriptor drift is caught before merge.

### Not yet shipped

- Standard-tier conformance (semantic checks beyond schema — broken `flow.targetScreenId`, token references, orphan screens).
- Extended-tier conformance (multi-document migration, patch round-trips).
- Compose / SwiftUI runtime preview kits — the descriptors declare the registry slots; the kits themselves are scheduled for a later sprint.

---

## [10.1.0-alpha.3] — 2026-05-21 (library descriptors + runtime walker + streaming patches)

The architectural unification: library descriptors with `nativeMapping` blocks become the universal contract that serves BOTH codegen consumers (Builder's React/SwiftUI/Compose pipelines) AND runtime consumers (the new walker), driven by the same descriptor.

### Added

- **`spec/v10/library-descriptor.schema.json`** — formal JSON Schema for library descriptors. Defines the `nativeMapping` table: per-component, per-target instantiation slots. Codegen targets (kind: 'codegen') emit source code; runtime targets (kind: 'runtime') refer to registered components. One descriptor → many output modes.
- **`spec/v10/libraries/shadcn-ui.json`** — first native library descriptor. 10 components (Card, Button, Input, Label, Heading, Text, Badge, Avatar, Separator, Stack), each with mappings for both `react` (codegen) and `runtime-react` (runtime walker) targets.
- **`@missionhud/appspec-runtime-react`** — 8th npm package. Runtime React renderer that walks an AppSpec live and mounts components via library-descriptor resolution. ~300 LOC reference impl. Exports: `createRegistry`, `createRuntime`, `<AppSpecRenderer>`, `<ScreenRenderer>`, `<ComponentRenderer>`, `useAppSpecStream` hook.
- **`createPatchStream()` in `@missionhud/appspec-patch`** — streaming RFC 6902 compiler. LLM/agent emits ops over time, stream applies them, consumers (including the runtime walker) repaint progressively. Inspired by Vercel json-render's stream model; built over our existing patch lifecycle so provenance touching + auto-apply heuristics still apply.

### Architectural significance

This release crystallises **two-mode consumption** as the spec's core shape:

- **Codegen mode** — AppSpec + library descriptor → source code (SwiftUI / Compose / React / Tailwind). The output runs standalone with no AppSpec runtime dependency. Builder's primary mode.
- **Runtime mode** — AppSpec + library descriptor → live UI via the walker, repainted by streaming patches. The walker stays in the render path. New mode, enabled by this release.

Both modes consume the same library descriptors. The same `nativeMapping` block carries entries for both codegen targets (e.g. `swiftui`, `compose`, `react`) and runtime targets (e.g. `runtime-react`, future `runtime-vue` / `runtime-svelte`).

### What this enables

- AI agents stream JSON Patches → UI updates live in the user's preview. No build step, no reload.
- AppSpec competes with Vercel json-render's generative-UI use case while keeping its differentiators (DTCG by reference, provenance, native-platform mappings).
- Consumers that want production code (Builder, third-party codegen tools) continue using the codegen path.
- Consumers that want ephemeral live UI (agent dashboards, AI chat rich messages) use the runtime path.

### Tested end-to-end

- shadcn-ui descriptor validates against library-descriptor schema
- Runtime walker resolves componentRef → library → registry → mounted React component
- propertyMap correctly remaps AppSpec names to component prop names (e.g. `label` → `children` for Button)
- Unknown componentRef falls back gracefully (or throws in strict mode)
- `createPatchStream` applies batches in order; 4 LLM-style patches produce 4 progressive snapshots; final spec has all changes; provenance accumulated correctly

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
