# AppSpec Governance

## 1. Maintainership

AppSpec is currently **Mission HUD-stewarded** under single-maintainer governance.

- **Legal entity / copyright holder**: Atmospherique Pty Ltd (Australia), publishing under the Mission HUD product family
- **Maintainer**: Mission HUD (`@bradmanners` is the working steward)
- **Decision-making**: maintainer-led with mandatory public comment for any change touching `spec/v10/schema.json` or `spec/v10/spec.md`
- **Tie-breakers**: maintainer

This model is intentional for the pre-1.0 era (alpha + early v10.1). It optimises for speed of iteration over consensus overhead. The migration path to multi-vendor governance is laid out in § 4.

## 2. RFC process

Any change that affects the schema's shape, semantics, or stability commitments goes through an RFC.

### What needs an RFC

| Change type | Process |
|---|---|
| Schema shape (`$defs`, properties, required fields) | RFC required |
| Spec semantics (what a field means) | RFC required |
| Versioning policy / deprecation rules | RFC required |
| Conformance tier definitions | RFC required |
| Reference implementation public API | RFC if it ships in `@missionhud/appspec-*` packages |
| Typo, clarification, example fix | PR, no RFC |
| Internal refactor of reference code | PR, no RFC |

### How to file an RFC

1. **Open a PR** adding a file at `spec/v10/rfc/NNN-short-name.md` where `NNN` is the next available number (look at the highest in the directory and add 1).
2. **The RFC body** should follow the template in `spec/v10/rfc/TEMPLATE.md` (lands when first RFC is filed): motivation, proposal, examples, drawbacks, alternatives, open questions.
3. **Public comment period: minimum 14 days** for breaking changes; minimum 7 days for additive changes. Maintainer can extend if discussion is active.
4. **Maintainer disposition**: accept, request changes, defer, or reject with rationale. Decisions are documented in the RFC PR.
5. **Accepted RFCs** land in the spec on the next minor or major release per semver (§ 3).

### What does NOT go through RFC

- Typo fixes, broken-link repairs, doc clarifications that don't change meaning
- Internal reference-implementation refactors (PR + review is sufficient)
- New conformance test cases that exercise existing schema rules
- Adding new canonical examples that demonstrate existing semantics

## 3. Versioning

AppSpec follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with three commitments tighter than baseline semver:

| Version axis | Triggered by | Backwards-compatible? |
|---|---|---|
| **MAJOR** (10 → 11) | Removing a required field; changing the meaning of an existing field; restructuring a `$defs` shape | No — existing valid specs may no longer validate |
| **MINOR** (10.0 → 10.1) | Adding optional fields; adding new `$defs`; extending enums by *adding* values | Yes — existing valid specs still validate |
| **PATCH** (10.0.0 → 10.0.1) | Clarifying spec text; fixing typos; tightening descriptions that didn't change semantics | Yes — identical schema, clearer prose |

### Stability commitments

1. **Major versions release ≥18 months apart** after v10's first stable release.
2. **Minor versions** release as needed; aim for quarterly cadence once v10.1 ships.
3. **Patch versions** can release immediately for typo / clarity fixes.

### Recorded evolution intents (2026-08-14)

Directions the maintainer has ratified, recorded here so contributors see the version mechanics up front:

- **The physics dimension** (how a composition renders: `paged · framed · flowing · navigated · timed`) and
  **archetype semantics for `ComponentInstance`** land **additively in a v10.x MINOR** — optional fields and
  new `$defs` only; existing valid specs keep validating, and lenient v10 readers pass the new fields through.
- **The `screens` → `surfaces` rename** changes a required Core-tier field and is therefore a **MAJOR**: it
  waits for **v11**, under the ≥18-months commitment above.
- **Cross-spec shared libraries** ("this AppSpec extends another AppSpec") remain out of scope until an RFC
  (§2) lifts the spec's explicit exclusion (spec/v10, *Not in scope*).

### Forever Backwards Read

> **Any tool that can read AppSpec v10 will read every future v10.x document.**

This is the strong commitment. v10.x readers will see v10.(x+1)-only fields as "additional properties" and either reject (strict mode) or pass through (lenient mode). It commits us to never making schema changes within a major version that can't be papered over by lenient mode in older readers.

### Deprecation policy

When a field is being removed in the next major version:

1. **Spec MINOR release** marks the field deprecated in its schema description (`"description": "DEPRECATED: removed in v11; use X instead."`).
2. **Validator** continues to accept the field with a warning (not an error) for the rest of the major version.
3. **Migration helper** is published in `@missionhud/appspec-migrate` that converts forward mechanically.
4. **Major version release** removes the field; old specs need migration.

### Identifier transition (Mockingbird → Mission HUD)

Specs in the wild from the pre-rename reference implementation carry `$schema: "mockingbird/app-spec/v10.x"`. For all of v10.x:

- The canonical `$schema` pattern accepts both `missionhud/appspec/v10.x` and `mockingbird/app-spec/v10.x` on read.
- New writes from the reference implementation emit the canonical `missionhud/appspec` form.
- Validators must accept both. The `mockingbird` form is **not** deprecated within v10 — it remains a valid read identifier for the lifetime of the major version.

This is a one-time exception driven by the rename; future identifier changes follow normal deprecation policy.

## 4. Migration to multi-vendor governance

Single-maintainer governance is the right model now but is not the long-term endgame. Multi-vendor governance — likely as a **W3C Community Group** (the precedent DTCG and other interoperability specs followed) — becomes the goal once the trigger condition lands.

### Trigger condition

When **3 or more external implementations ship** and are in active use (where "external" = produced by entities other than Mission HUD), the maintainer initiates migration to multi-vendor governance within 90 days.

### What "ship" means for the trigger

- Tagged release of an open-source implementation, *or*
- Production-deployed proprietary implementation with public conformance claim, *or*
- Acceptance into a registry / marketplace that distinguishes the implementation

### What the maintainer retains under multi-vendor governance

- The **"Mission HUD AppSpec"** branded variant — if multi-vendor governance produces design-by-committee compromises, Mission HUD retains the right to ship an extension layer under its brand
- The **reference implementation packages** (`@missionhud/appspec-*` on npm) — forks allowed; the namespaced packages stay maintained by Mission HUD
- The **conformance test suite** until the multi-vendor body assumes governance of that surface

### What changes under multi-vendor governance

- Schema RFCs are decided by the W3C Community Group's process, not the maintainer
- The CC-BY 4.0 spec license stays the same; copyright assignments will track standard W3C-CG patterns
- The repo stays at `github.com/missionhud/appspec` but the maintainer adds CG members as co-maintainers

## 5. Conformance

AppSpec defines three conformance tiers (Core / Standard / Extended; see `README.md` § Conformance). External implementations claim a tier by:

1. **Running the public conformance test suite** at `spec/v10/conformance/` (lands in v10.1.0)
2. **Publishing test results** in a discoverable location (their docs, a `.well-known/appspec-conformance.json` file, or a PR to `appspec-compliant/` index repo)
3. **Optionally** opening an issue with the `conformance-claim` label to request inclusion in the documented adapter directory

Self-claim is the standard. No paid certification at this stage. Maintainer reserves the right to revoke documented-adapter status if a claim is materially incorrect; the implementation can keep the self-claim as long as they don't misrepresent the source.

## 6. Trademark and naming

- **"AppSpec"** is a generic term (prior art across multiple unrelated projects) and is not trademarked.
- **"Mission HUD AppSpec"** is the branded variant maintained here. External use of this term implies Mission HUD endorsement.
- **"missionhud/appspec"** is the canonical npm + GitHub namespace; reserved.

External implementations may say:

- ✅ "Compatible with AppSpec v10"
- ✅ "Implements AppSpec v10 Core"
- ✅ "AppSpec consumer / producer / adapter"
- ❌ "Mission HUD AppSpec" without Mission HUD coordination
- ❌ Using the Mission HUD logo without permission

## 7. Code of Conduct

Behaviour in this repository follows the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). The maintainer is responsible for enforcement; egregious or repeated violations may result in being barred from the repository.

## 8. Contact

- **Issues, PRs, RFCs**: file in this repository
- **Security concerns**: open a security advisory via GitHub's security tab (see `SECURITY.md` when it lands)
- **Other coordination** (partnership, multi-vendor governance proposals): TBD; will publish a contact route at v10.1.0 launch
