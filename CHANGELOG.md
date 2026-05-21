# Changelog

All notable changes to AppSpec will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Schema versions are tracked separately from release versions: a v10.x release may publish updated tooling without changing the schema, in which case `SCHEMA_VERSION` (in the schema metadata) stays at `10.0.0`.

---

## [Unreleased]

### Planned for v10.1.0

- `originMissionId` field on root for Mission HUD family integration
- `relevantMissions[]` association list for many-to-many mission reuse
- `sourceTimeline` alignment with W3C PROV shape (interop with Discovery + Builder audit chains)
- Reference adapter for Figma round-trip
- Reference adapter for React + DTCG → Tailwind theme generation
- Conformance test suite (Core tier first; Standard + Extended in v10.2)
- npm packages: `@missionhud/appspec-{core,validate,lint,patch,migrate,provenance,cli}`

---

## [10.1.0-alpha.0] — 2026-05-21

Initial pre-release. Repository created at `github.com/missionhud/appspec`. Schema extracted from the Mission HUD Designer reference implementation (formerly Mockingbird Lab). Pre-launch posture: rapid iteration; semantics of `spec/v10/` are intended-stable; everything else is exploratory.

### Added

- `spec/v10/schema.json` — canonical JSON Schema (Draft 2020-12), schema version `10.0.0`
- `spec/v10/spec.md` — human-readable specification (initial draft; expanding through alpha)
- `README.md` — project orientation
- `LICENSE-SPEC` (CC-BY 4.0) — specification document license
- `LICENSE-CODE` (MIT) — reference implementation code license
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
