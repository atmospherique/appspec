# @missionhud/appspec-adapter-tailwind

Reference adapter: AppSpec DTCG `designTokens` → Tailwind CSS theme config. Pure transform; no Tailwind runtime dependency.

## Install

```bash
npm install @missionhud/appspec-adapter-tailwind
```

## Use

```js
const { toTailwindTheme, toTailwindConfig } = require('@missionhud/appspec-adapter-tailwind');

const designTokens = {
  color: {
    primary:       { $value: '#0066CC', $type: 'color' },
    'primary-hover': { $value: '{color.primary}', $type: 'color' },  // reference
    background:    { $value: '#FFFFFF', $type: 'color' },
  },
  dimension: {
    spacing: {
      sm: { $value: '8px',  $type: 'dimension' },
      md: { $value: '16px', $type: 'dimension' },
      lg: { $value: '24px', $type: 'dimension' },
    },
    radius: {
      sm: { $value: '4px',  $type: 'dimension' },
      md: { $value: '8px',  $type: 'dimension' },
    },
  },
};

const theme = toTailwindTheme(designTokens);
// → {
//     colors: { primary: '#0066CC', 'primary-hover': '#0066CC', background: '#FFFFFF' },
//     spacing: { sm: '8px', md: '16px', lg: '24px' },
//     borderRadius: { sm: '4px', md: '8px' }
//   }

const configString = toTailwindConfig(designTokens);
// → complete tailwind.config.js content as a string
//   (with the theme.extend injected; caller writes to disk)
```

## Coverage

| DTCG group | Tailwind output |
|---|---|
| `color.*` | `theme.extend.colors` |
| `dimension.spacing.*` | `theme.extend.spacing` |
| `dimension.radius.*` | `theme.extend.borderRadius` |
| `typography.fontFamily.*` | `theme.extend.fontFamily` |
| `typography.fontSize.*` | `theme.extend.fontSize` |
| `shadow.*` | `theme.extend.boxShadow` |

Token references like `{color.primary}` are resolved to literal values at transform time (Tailwind config can't follow runtime references). Chained references work.

This is a **reference** implementation — minimal coverage. Production use cases (CSS custom properties output, dark-mode handling via mode-aware DTCG resolver, design-token-aware utility generators) should extend or replace.

## API

### `toTailwindTheme(designTokens) → object`

Returns the `theme.extend` object suitable for `tailwind.config.js`.

### `toTailwindConfig(designTokens, opts?) → string`

Returns a complete `tailwind.config.js` content string with `theme.extend` injected. Caller writes to disk.

| Option | Default |
|---|---|
| `content` | `['./src/**/*.{js,jsx,ts,tsx,html}']` — passed through to Tailwind's `content` field |

## License

MIT. See [LICENSE-MIT](https://github.com/missionhud/appspec/blob/main/LICENSE-MIT) at the repo root.
