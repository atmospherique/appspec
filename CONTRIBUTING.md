# Contributing to AppSpec

Thanks for your interest. AppSpec is currently in **pre-release** (`v10.1.0-alpha`), shipping toward a stable `v10.1.0` in June 2026. Contributions are welcome with the caveats below.

## What's appropriate to contribute today

| Contribution | Welcome? |
|---|---|
| Typo, broken-link, clarification PRs against `README.md`, `spec/v10/spec.md`, etc. | ✅ Yes, anytime |
| New canonical example AppSpecs in `spec/v10/examples/` | ✅ Yes — please include validation against the schema |
| Bug reports against the schema itself (legitimately invalid behaviour, contradictory constraints) | ✅ Yes — open an issue with the `schema-bug` label |
| Schema additions or modifications | ⚠️  RFC required (see `GOVERNANCE.md` § 2) |
| Reference-implementation code (`packages/`) | ⏳ Not yet — `packages/` lands in v10.1.0; PRs against it pre-launch will be deferred |
| Conformance test cases | ⏳ Not yet — conformance suite scaffolds with v10.1.0 |
| New `adapters/` for other tools | ⏳ Not yet — `adapters/` lands with v10.1.0 and will have specific contribution requirements |

If you're not sure which bucket your contribution fits, open an issue first to ask.

## How to file an issue

| Issue kind | Template |
|---|---|
| Bug in the schema or spec text | `bug` template (lands soon) |
| Idea for a v10.x addition | `rfc` template (lands soon) — start with the discussion before the PR |
| Compatibility claim or implementation announcement | `compatibility` label |
| Security concern | Use GitHub's [security advisory](https://docs.github.com/en/code-security/security-advisories) flow, not a public issue |

Until the issue templates land, plain markdown is fine — please indicate the category in the title (`[bug]`, `[rfc]`, `[compat]`).

## PRs

- Fork → branch → PR. One concern per PR; mixing typo fixes with semantic changes will get split.
- For schema or spec text changes, link the related RFC.
- For implementation code (when `packages/` lands), include tests.
- Sign off your commits (`git commit -s`) — we use the [Developer Certificate of Origin](https://developercertificate.org/) to keep contribution clean without requiring a CLA.

## Code style

When `packages/` lands:

- TypeScript (strict mode)
- ESLint + Prettier defaults (config in repo root)
- Tests with the runtime that ships with the package (probably `node:test`)
- Conventional commit messages encouraged but not enforced

## RFC process at a glance

Schema-touching changes go through the RFC process. Full details in [`GOVERNANCE.md`](GOVERNANCE.md) § 2. The short version:

1. Open a PR adding `spec/v10/rfc/NNN-short-name.md` (next available number)
2. Body covers: motivation, proposal, examples, drawbacks, alternatives, open questions
3. Public comment period: 7 days (additive) or 14 days (breaking)
4. Maintainer accepts / requests changes / defers / rejects with rationale
5. Accepted RFCs land in the spec on the next minor or major release per semver

## Conduct

[Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be excellent to each other.

## Questions

If something's unclear, open a [discussion](https://github.com/missionhud/appspec/discussions) (once enabled) or an issue.
