# @missionhud/appspec-lint

Cross-reference integrity linter for AppSpec v10. The JSON Schema validates *shape*; this package validates *integrity*. Both should pass before an AppSpec is shipped.

## Install

```bash
npm install @missionhud/appspec-lint
```

## Use

```js
const { lint } = require('@missionhud/appspec-lint');

const { valid, issues, summary } = lint(mySpec);

if (!valid) {
  for (const issue of issues) {
    console.log(`[${issue.severity}] ${issue.path} — ${issue.message}`);
  }
}
console.log(summary); // { errors: N, warnings: M }
```

## Rules

| Rule | Severity | What it checks |
|---|---|---|
| Flow.start exists | error | `Flow.start` references a step that's actually in `Flow.steps[]` |
| FlowStep.screenId resolves | error | `FlowStep.screenId` (for `kind: 'screen'`) references a real screen |
| FlowStep.edgesTo resolves | error | Edge targets exist within the same flow's steps |
| Navigation.items[].screenId resolves | error | Tab/drawer items point at real screens |
| ComponentInstance assetId resolves | error | `{ assetId: "asset_..." }` in properties finds the asset in registry |
| TokenRef resolves | error | `"{color.primary}"` style refs resolve to defined `designTokens` paths |
| AssetRef alt text | warning | Visible asset kinds (image, vector, lottie, gif, video, video-embed) without `alt` |
| Orphaned screen | warning | Screen not referenced by any flow or navigation |
| Tombstone reference | warning | Reference to a node with `_provenance._tombstone` set |

## API

### `lint(spec) → { valid, issues, summary }`

```ts
{
  valid: boolean,   // true iff zero errors (warnings don't block)
  issues: Array<{
    severity: 'error' | 'warning',
    path: string,        // JSON-pointer-style path to the offending node
    message: string,
    kind: string         // rule kind: dangling-reference, undefined-token, missing-alt-text, etc.
  }>,
  summary: { errors: number, warnings: number }
}
```

### `buildTokenPaths(designTokens) → Set<string>`

Helper that walks a DTCG-shaped `designTokens` object and returns the set of defined token paths (e.g. `"color.primary"`, `"dimension.spacing.md"`). Used internally; exposed for callers that want to do their own token-ref checking.

### `TOKEN_REF_RX` / `VISIBLE_ASSET_KINDS`

Exposed for callers that want to apply the same token-ref pattern or visible-asset classification.

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
