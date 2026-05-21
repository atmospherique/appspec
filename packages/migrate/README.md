# @missionhud/appspec-migrate

Version migration helpers for AppSpec. Today: **v9 → v10**. Future major-version migrations (v10 → v11) will land here when those versions exist.

## Install

```bash
npm install @missionhud/appspec-migrate
```

## Use

```js
const { migrate } = require('@missionhud/appspec-migrate');

const v9Spec = { /* loose v9 AppSpec without provenance / schema id / etc. */ };

const { spec, warnings, migrated } = migrate(v9Spec);

if (migrated) {
  console.log('Migration applied');
  console.log('Warnings:', warnings);
  // spec is now a valid v10 AppSpec
}
```

## What v9 → v10 does

1. Stamps `$schema = "missionhud/appspec/v10.0.0"` (legacy `mockingbird/app-spec/v10.x` accepted on read; new writes use the missionhud form)
2. Assigns a `proj_<id>` if `id` is missing
3. Defaults `identity = { name: "Untitled App" }` if missing
4. Defaults `libraryRefs = { components: "missionhud-default", icons: "material-symbols" }` if missing
5. Walks every Screen — coerces id to `screen_*`, stamps `_provenance` with `source: 'unknown'` if missing
6. Walks every ComponentInstance — coerces id to `comp_*`, stamps `_provenance` if missing
7. Moves `_meta.anchors` and any other v9-only root fields into `$extensions['com.mockingbird'].{anchors,_meta,legacy}` (preserved for back-compat, namespaced so they don't conflict with `$extensions['com.missionhud']`)
8. Drops legacy `screen.sections` (v10 uses `screen.components`)
9. Validates the result against the v10 schema and surfaces any remaining warnings

Idempotent — running on an already-v10 spec is a no-op for structural fields and just re-validates.

## API

### `migrate(input) → { spec, warnings, migrated }`

```ts
{
  spec: object | null,   // the migrated v10 AppSpec, or null on invalid input
  warnings: string[],    // human-readable notes about defaulting / coercion that happened
  migrated: boolean      // true if a real migration happened (false on invalid input)
}
```

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
