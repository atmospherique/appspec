# AppSpec v10 Conformance Test Suite

Test cases an implementation must pass to claim conformance at each tier.

## Tiers

| Tier | Coverage | Test directories |
|---|---|---|
| **Core** | `$schema`, `id`, `identity`, `libraryRefs`, `screens` (with `components`), `_provenance` | `core/valid/`, `core/invalid/` |
| **Standard** *(coming v10.2)* | Core + `designTokens`, `assets`, `navigation`, `contentGuidelines`, `designDirection` | `standard/` |
| **Extended** *(coming v10.2)* | Standard + `userFlows`, `styleOverrides`, `vision`, `targetUsers`, full provenance with sourceTimeline + tombstones, RFC 6902 patch lifecycle | `extended/` |

## How to run

```bash
# From the appspec repo root
node spec/v10/conformance/run.js                # all tiers
node spec/v10/conformance/run.js --tier=core    # specific tier
node spec/v10/conformance/run.js --json         # machine-readable output
```

## How to claim conformance

External implementations claim a tier by running the test suite and publishing the results:

1. Clone this repo, run `node spec/v10/conformance/run.js --tier=core --json > my-conformance.json`
2. Run your validator/lint/migrate against each `valid/*.json` (expect pass) and `invalid/*.json` (expect fail) test case
3. Publish the results file in your tool's docs at a discoverable URL (your repo's README, a `.well-known/appspec-conformance.json`, or a PR to the documented adapter directory)

Self-claim is the standard. No paid certification at this stage. The maintainer reserves the right to revoke documented-adapter status if a claim is materially incorrect.

## Test case naming

Each test case is a single JSON file. The filename describes what's being tested:

- `core/valid/minimal-spec.json` — the smallest possible valid AppSpec
- `core/valid/multiple-screens.json` — multi-screen valid spec
- `core/invalid/missing-id.json` — root spec missing `id` (should fail validation)
- `core/invalid/bad-schema-id.json` — wrong `$schema` value (should fail)

Each invalid case ships with a sidecar `.expected.json` declaring the errors a conformant validator should report.

## License

The test cases themselves are CC-BY 4.0 (specification artifacts). Test runner code is MIT.
