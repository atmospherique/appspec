# @missionhud/appspec-validate

Ajv-backed validator + slug expansion for AppSpec v10. Pairs naturally with `@missionhud/appspec-core` (which ships the schema) and `@missionhud/appspec-provenance` (which produces the audit envelopes the schema requires).

## Install

```bash
npm install @missionhud/appspec-validate
```

(Pulls in `@missionhud/appspec-core` as a peer-style dep.)

## Use

```js
const { validate, validateAndExpand } = require('@missionhud/appspec-validate');

// 1. Strict validation — assumes componentRefs are already qualified
const r = validate(myAppSpec);
if (!r.valid) {
  console.error('Invalid AppSpec:', r.errors);
}

// 2. Slug expansion + validation — accepts bare slugs ("HeroCard")
// and qualifies via libraryRefs.components default before validating
const r2 = validateAndExpand(myAppSpec, { mutate: false });
console.log('expanded', r2.expanded, 'bare slugs into qualified form');
console.log('valid:', r2.valid);
```

## API

### `validate(spec) → { valid, errors }`

Pure validation. Returns:

```ts
{
  valid: boolean,
  errors: Array<{
    path: string,         // JSON pointer to the failing field, e.g. "/screens/content/0/components/0/componentRef"
    message: string,      // Ajv error message
    schemaPath: string,   // path within the schema that failed
    params: object        // Ajv-specific error context (missing property name, expected enum, etc.)
  }>
}
```

### `validateAndExpand(spec, opts?) → { valid, errors, spec, expanded }`

Runs slug expansion first, then validates. Bare componentRefs (e.g. `"HeroCard"`) get qualified via `spec.libraryRefs.components` (e.g. → `"missionhud-default/HeroCard"`). The resolution is stamped into `_provenance.slugResolution` on each affected component for traceability.

Options:

| Option | Default | What |
|---|---|---|
| `mutate` | `true` | Apply expansion + slug-resolution stamping in place. Set `false` to deep-clone the spec first. |

Returns the same shape as `validate()` plus:
- `spec` — the (possibly mutated) spec
- `expanded` — count of bare slugs that were qualified

### `expandSlugs(spec) → { expanded }`

Exposed for callers that want to expand without validating (e.g. for serialisation through an MCP boundary where the receiver validates).

### `getValidator() → Ajv compiled function`

The raw compiled Ajv validator. Exposed for advanced callers (e.g. custom error formatting).

## Why Ajv strict mode is off

The v10 schema uses Draft 2020-12 keywords (`oneOf` with `const` discriminators, `propertyNames`, `unevaluatedProperties`, etc.) that trigger Ajv strict-mode warnings without affecting validation correctness. The schema is well-formed; we just don't want the warnings on every load.

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
