# @missionhud/appspec-core

Canonical AppSpec v10 JSON Schema + identifier helpers. The foundation package every other `@missionhud/appspec-*` package depends on.

## Install

```bash
npm install @missionhud/appspec-core
```

## Use

```js
const { SCHEMA, SCHEMA_ID, isV10SchemaId } = require('@missionhud/appspec-core');

console.log(SCHEMA_ID);
// → "missionhud/appspec/v10.0.0"

console.log(isV10SchemaId('missionhud/appspec/v10.0.0'));
// → true

console.log(isV10SchemaId('mockingbird/app-spec/v10.0.0'));
// → true  (legacy form accepted on read)

console.log(isV10SchemaId('something/else/v1.0.0'));
// → false

// SCHEMA is the parsed JSON Schema object — pass to Ajv or any validator
// (most consumers use @missionhud/appspec-validate instead of compiling
// the schema directly).
```

## What this exports

| Export | Type | Description |
|---|---|---|
| `SCHEMA` | object | The parsed JSON Schema (Draft 2020-12) |
| `SCHEMA_VERSION` | string | `"10.0.0"` |
| `SCHEMA_ID` | string | `"missionhud/appspec/v10.0.0"` — canonical for new writes |
| `LEGACY_SCHEMA_ID` | string | `"mockingbird/app-spec/v10.0.0"` — accepted on read; pre-rename specs in the wild carry this |
| `isV10SchemaId(s)` | function | Returns true for any accepted v10 `$schema` value (legacy or canonical) |
| `loadSchema()` | function | Re-reads the schema from disk; mainly for tests |

## Why a separate `core` package

Other `@missionhud/appspec-*` packages (validate, lint, patch, migrate, provenance, cli) all depend on the schema and identifier helpers. Putting them in a small core package avoids:

- Each package shipping a duplicate copy of `schema.json`
- Drift between packages on schema-id detection
- Heavy dependency cascades (consumers who just need to check `isV10SchemaId` shouldn't have to install Ajv)

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
