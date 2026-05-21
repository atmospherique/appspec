# @missionhud/appspec-patch

RFC 6902 JSON Patch helpers for AppSpec v10. Apply patches to an AppSpec, touch the provenance of every affected node, and evaluate auto-apply heuristics. **Pure functions — no database coupling.** Productized patch lifecycles (Postgres-backed propose/apply/reject with version concurrency) are downstream and product-specific.

## Install

```bash
npm install @missionhud/appspec-patch
```

(Pulls in `@missionhud/appspec-provenance` and `fast-json-patch` as deps.)

## Use

### Apply a patch to a spec

```js
const { applyPatchToSpec } = require('@missionhud/appspec-patch');

const { newSpec, touchedNodes } = applyPatchToSpec(
  mySpec,
  [
    { op: 'replace', path: '/screens/content/0/components/0/properties/title', value: 'New title' },
    { op: 'add',     path: '/assets/asset_hero_bg/alt', value: 'Hero background' },
  ],
  { source: 'mockingbird-ai', note: 'AI suggested title + alt text' }
);

console.log(touchedNodes);
// → ['/screens/content/0/components/0', '/assets/asset_hero_bg']
//   Root + these two nodes had their _provenance bumped + sourceTimeline appended.
```

### Auto-apply heuristic

```js
const { isStructurallyAutoApplicable } = require('@missionhud/appspec-patch');

const safe = isStructurallyAutoApplicable({
  operations: [{ op: 'replace', path: '/identity/name', value: 'New Name' }],
  proposedBy: 'mockingbird-ai',
});
// → true (≤3 ops, no remove/move, from a trusted source)

const destructive = isStructurallyAutoApplicable({
  operations: [{ op: 'remove', path: '/screens/content/0' }],
  proposedBy: 'human-edit',
});
// → false (remove op + non-trusted source)
```

### Find provenance-bearing ancestor

```js
const { findProvenanceAncestor } = require('@missionhud/appspec-patch');

findProvenanceAncestor('/screens/content/0/components/0/properties/title');
// → '/screens/content/0/components/0'   (the ComponentInstance)

findProvenanceAncestor('/screens/content/0/name');
// → '/screens/content/0'   (the Screen)

findProvenanceAncestor('/assets/asset_hero_bg/url');
// → '/assets/asset_hero_bg'   (the AssetRef)

findProvenanceAncestor('/identity/name');
// → null   (identity is leaf metadata, not a provenance-bearing node)
```

## What about propose / apply / reject lifecycle?

Those are **product-specific** because they couple to a storage layer (Postgres tables, version labels, optimistic concurrency on `based_on`, etc.). This package gives you the pure semantics; products build their own lifecycle on top.

The reference Mission HUD Designer implementation lives in [`mockingbird-lab/proxy-server/lib/mcp/store/patches.js`](https://github.com/bradmanners/mockingbird-lab/blob/main/proxy-server/lib/mcp/store/patches.js) — read it as the canonical pattern; adapt for your own store.

## API

| Export | Type | Description |
|---|---|---|
| `applyPatchToSpec(spec, operations, opts)` | function | Apply RFC 6902 ops + touch provenance everywhere affected |
| `touchAffectedNodes(spec, operations, opts)` | function | Just the provenance-touching pass (use after applying ops yourself) |
| `findProvenanceAncestor(path)` | function | Walk a JSON pointer up to the nearest provenance-bearing node path |
| `isStructurallyAutoApplicable({operations, proposedBy})` | function | Heuristic for "can this patch auto-apply" |
| `generatePatchId()` | function | Random `patch_<hex>` id |
| `AUTO_APPLY_TRUSTED_SOURCES` | Set | `{ mockingbird-ai, preset-load, figma-import }` |
| `AUTO_APPLY_MAX_OPS` | number | `3` |
| `DESTRUCTIVE_OPS` | Set | `{ remove, move }` |

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
