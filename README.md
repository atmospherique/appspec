# AppSpec

> **The open JSON Schema for AI-native app specification.** Schema as contract. Provenance as default. Designed so AI agents, design tools, and code generators speak the same structured language about *what an app is.*

**Status:** `v10.1.0-alpha` — pre-release. First stable release targets June 2026. The schema shape is finalised; documentation, conformance tests, and reference adapters are being added.

---

## What this is

AppSpec is a JSON Schema (Draft 2020-12) that defines the canonical structure of an application's intent, design, content, and lifecycle metadata — independent of any specific design tool, code framework, or AI model.

A valid AppSpec describes:

- **Identity** — name, description, category, target platforms, default locale
- **Vision + target users + design direction + content guidelines** — narrative intent
- **Component libraries** — pluggable (`mockingbird-default`, `ios-18`, `material-3`, …)
- **Design tokens** — W3C DTCG by reference
- **Screens** — flat list of v9 Component instances per screen, with layout + variants + properties
- **Navigation + user flows** — tab bars, drawers, directed graphs of flow steps
- **Assets** — image / vector / lottie / video / font / audio, registered by id
- **Provenance** — every node carries `createdBy`, `lastEditedBy`, `sourceTimeline` (W3C PROV-shaped audit trail)
- **Patch lifecycle** — RFC 6902 JSON Patch with `propose / apply / reject` semantics and optimistic concurrency

The shape is deliberately **AI-friendly and tool-agnostic**: any AI agent can read or write an AppSpec; any design tool (Figma, Sketch, Penpot) can render or extract one; any code generator can compile from one.

## What this is *not*

- **Not a design tool.** AppSpec is the format; tools that produce/consume it are separate products.
- **Not a runtime.** AppSpec describes what an app *is*, not what it *does* at runtime. Behaviour lives in code.
- **Not a Figma file format.** AppSpec is portable across design tools. Figma is one consumer.
- **Not a code framework.** Adapters compile AppSpec → React / SwiftUI / Compose / etc. The spec itself is framework-agnostic.

## Why open

AppSpec exists because the AI design / code tooling ecosystem is converging on the same primitives — design tokens (DTCG), structured component definitions, semantic intent, audit trails — but every tool ships its own proprietary shape. A vendor-neutral interchange format lets agents and tools compose without lock-in.

The spec is open under **CC-BY 4.0**; the reference implementation is open under **MIT**. See `LICENSE-SPEC` and `LICENSE-CODE`.

## Status — what's here, what's coming

**Available in this repo (v10.1.0-alpha):**

- `spec/v10/schema.json` — the canonical JSON Schema
- `spec/v10/spec.md` — human-readable specification with rationale
- `LICENSE-SPEC` + `LICENSE-CODE` — dual licensing
- `GOVERNANCE.md` — RFC process, maintainership, migration path
- `CHANGELOG.md` — versioned history

**Landing soon (v10.1.0 stable, June 2026):**

- `packages/` — `@missionhud/appspec-{core,validate,lint,patch,migrate,provenance,cli}` npm packages
- `adapters/` — reference adapters for Figma, React, Tailwind
- `spec/v10/conformance/` — test suite (Core / Standard / Extended tiers)
- `spec/v10/examples/` — canonical example AppSpecs covering different app types
- Documentation site

**On the roadmap (post-v10.1):**

- Additional reference adapters (SwiftUI, Jetpack Compose, MJML for email, shadcn/ui)
- Second-party adapters (Anima, Builder.io, Subframe, Penpot — coordination starting at v10.1 launch)
- Conformance certification process
- Migration path to W3C Community Group governance (triggers at 3+ external implementers shipping)

See `ROADMAP.md` (coming) for the full picture.

## Conformance — three tiers

Implementations claim conformance at one of three levels:

| Level | Coverage |
|---|---|
| **Core** | `$schema`, `id`, `identity`, `libraryRefs`, `screens` (with components), `_provenance`. Minimum for a valid spec. |
| **Standard** | Core + `designTokens` (DTCG), `assets` registry, `navigation`, `contentGuidelines`, `designDirection`. Most real consumers target this. |
| **Extended** | Standard + `userFlows`, `styleOverrides`, `vision`, `targetUsers`, full provenance with `sourceTimeline` + tombstones, RFC 6902 patch lifecycle. The full surface. |

Once the test suite ships (v10.1.0), implementers claim compliance via a public test-result file. No paid certification at this stage.

## Versioning

AppSpec follows semver with one strong commitment:

> **Forever Backwards Read.** Any tool that can read AppSpec v10 will read every future v10.x document. Major versions (v11, v12, …) release ≥18 months apart minimum, with a migration helper published alongside.

See `GOVERNANCE.md` for the full versioning + deprecation policy.

## Quick example

A minimal valid AppSpec:

```json
{
  "$schema": "missionhud/appspec/v10.0.0",
  "id": "proj_abc123",
  "identity": {
    "name": "Hello App"
  },
  "libraryRefs": {
    "components": "missionhud-default",
    "icons": "material-symbols"
  },
  "screens": {
    "content": [
      {
        "id": "screen_home",
        "name": "Home",
        "purpose": "landing",
        "components": [
          {
            "id": "comp_hero",
            "componentRef": "missionhud-default/HeroCard",
            "properties": { "title": "Welcome" },
            "_provenance": {
              "createdBy": "human-edit",
              "createdAt": "2026-05-21T00:00:00Z",
              "lastEditedBy": "human-edit",
              "lastEditedAt": "2026-05-21T00:00:00Z",
              "sourceTimeline": [
                { "source": "human-edit", "at": "2026-05-21T00:00:00Z" }
              ]
            }
          }
        ],
        "_provenance": {
          "createdBy": "human-edit",
          "createdAt": "2026-05-21T00:00:00Z",
          "lastEditedBy": "human-edit",
          "lastEditedAt": "2026-05-21T00:00:00Z",
          "sourceTimeline": [
            { "source": "human-edit", "at": "2026-05-21T00:00:00Z" }
          ]
        }
      }
    ]
  },
  "_provenance": {
    "createdBy": "human-edit",
    "createdAt": "2026-05-21T00:00:00Z",
    "lastEditedBy": "human-edit",
    "lastEditedAt": "2026-05-21T00:00:00Z",
    "sourceTimeline": [
      { "source": "human-edit", "at": "2026-05-21T00:00:00Z" }
    ]
  }
}
```

More examples coming in `spec/v10/examples/`.

## Reference implementation

The first reference implementation is **Mission HUD Designer** (formerly Mockingbird Lab) — a Figma plugin + proxy server that produces and consumes AppSpec via MCP. The Designer codebase is the source of the schema definitions, validation, lint, patch lifecycle, and migration helpers that will land here as `@missionhud/appspec-*` npm packages in June 2026.

Other Mission HUD products consume AppSpec:

- **Mission HUD Builder** — turns AppSpec + intent docs into shipped code (Electron desktop)
- **Mission HUD Business** — uses DTCG token references + component library to render brand-aligned content across marketing, sales, education, support
- **Mission HUD Discovery** — surfaces design decisions as evidence-chained Knowledge Objects

External implementations are explicitly invited (see `GOVERNANCE.md` § 3).

## How to engage

- **Found a schema bug?** File an issue.
- **Have an idea for a v10.x addition?** File an RFC (template in `.github/ISSUE_TEMPLATE/rfc.yml` — landing soon).
- **Building an AppSpec consumer?** Open an issue tagged `compatibility` describing what you're building; we'd like to feature your adapter in the docs.

Until v10.1.0 ships, expect rapid iteration. Pre-release semantics: anything in `spec/v10/` is intended to be stable; anything else is exploratory.

## Licensing

| | License |
|---|---|
| **Specification documents** (`spec/`, `*.md` outside `packages/`) | [CC-BY 4.0](LICENSE-SPEC) — share and adapt with attribution |
| **Reference implementation code** (`packages/`, `adapters/`) | [MIT](LICENSE-CODE) — do whatever you want |

This follows the W3C / OpenAPI / JSON Schema pattern: specs are content (CC-BY); code is code (MIT).

---

*"AppSpec" as a term has prior art across multiple unrelated projects (AWS CodeDeploy, Windows, etc.) and is not trademarked. The branded variant maintained here is **Mission HUD AppSpec**. External implementations are welcome to claim "Compatible with AppSpec v10" without endorsement; "Mission HUD AppSpec" implies coordination with the maintainer.*
