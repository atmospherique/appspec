# @missionhud/appspec-cli

Mission HUD AppSpec — command-line interface. Validate, lint, migrate, and inspect AppSpecs from your terminal.

## Install

```bash
# Global install — provides the `appspec` binary
npm install -g @missionhud/appspec-cli

# Or run without installing
npx @missionhud/appspec-cli validate ./my-spec.json
```

## Use

```bash
# Validate against the schema
appspec validate ./my-spec.json

# Validate with bare-slug expansion (qualifies "HeroCard" → "missionhud-default/HeroCard")
appspec validate ./my-spec.json --expand

# Cross-reference integrity checks (flow→screen, asset, token, orphans, a11y)
appspec lint ./my-spec.json

# Validate + lint in one
appspec check ./my-spec.json

# Migrate a v9 AppSpec to v10
appspec migrate ./old-spec.json --out ./new-spec.json
appspec migrate ./old-spec.json --in-place
appspec migrate ./old-spec.json > ./new-spec.json

# Inspect what the CLI knows about
appspec info

# Help + version
appspec --help
appspec --version
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation / lint / migration failure |
| `2` | Usage error (missing argument, unknown command) |

Useful in CI:

```yaml
- name: Validate AppSpec
  run: npx @missionhud/appspec-cli check ./my-spec.json
```

## Programmatic API

If you want to embed these commands in your own tool:

```js
const { cmdValidate, cmdLint, cmdCheck, cmdMigrate, cmdInfo } = require('@missionhud/appspec-cli');

const exitCode = cmdValidate('./my-spec.json');
// → 0 on success, 1 on failure
```

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
