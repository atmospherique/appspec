/**
 * @missionhud/appspec-adapter-tailwind
 *
 * Pure transform: AppSpec DTCG designTokens → Tailwind theme config.
 *
 * DTCG tokens use the {$value, $type} shape. Tailwind theme config
 * uses nested objects keyed by category (colors, spacing, fontFamily,
 * fontSize, etc.). This adapter walks the DTCG tree and emits a
 * Tailwind-shaped theme.extend object suitable for tailwind.config.js.
 *
 * Reference behavior:
 *   - color tokens → theme.extend.colors
 *   - dimension tokens with spacing/* path → theme.extend.spacing
 *   - dimension tokens with radius/* path → theme.extend.borderRadius
 *   - typography.fontFamily.* → theme.extend.fontFamily
 *   - typography.fontSize.* → theme.extend.fontSize
 *   - shadow tokens → theme.extend.boxShadow
 *
 * Token references (`{color.primary}`) are resolved to their literal
 * values at transform time. Tailwind config consumers can't follow
 * runtime references.
 *
 * This is a REFERENCE implementation — minimal coverage. Production
 * use cases (CSS custom properties output, design-token-aware utility
 * generators, dark-mode handling) should extend or replace.
 */

'use strict';

const TOKEN_REF_RX = /^\{([a-z]+(?:\.[a-z0-9_-]+)+)\}$/;

/**
 * Transform an AppSpec's designTokens (DTCG) into a Tailwind
 * theme.extend object.
 *
 * @param {object} designTokens - DTCG-shaped token tree
 * @returns {object} Tailwind theme.extend config (colors, spacing, etc.)
 */
function toTailwindTheme(designTokens) {
  if (!designTokens || typeof designTokens !== 'object') return {};

  const valueByPath = buildValueIndex(designTokens);
  const resolveRef = (v) => resolveReference(v, valueByPath);

  const theme = {};

  // color group → colors
  if (designTokens.color) {
    theme.colors = flatten(designTokens.color, resolveRef);
  }

  // dimension.spacing.* → spacing; dimension.radius.* → borderRadius
  if (designTokens.dimension) {
    if (designTokens.dimension.spacing) {
      theme.spacing = flatten(designTokens.dimension.spacing, resolveRef);
    }
    if (designTokens.dimension.radius) {
      theme.borderRadius = flatten(designTokens.dimension.radius, resolveRef);
    }
  }

  // typography.fontFamily.* / fontSize.*
  if (designTokens.typography) {
    if (designTokens.typography.fontFamily) {
      theme.fontFamily = flatten(designTokens.typography.fontFamily, resolveRef);
    }
    if (designTokens.typography.fontSize) {
      theme.fontSize = flatten(designTokens.typography.fontSize, resolveRef);
    }
  }

  // shadow group → boxShadow
  if (designTokens.shadow) {
    theme.boxShadow = flatten(designTokens.shadow, resolveRef);
  }

  return theme;
}

/**
 * Build a flat path → value map from a DTCG tree. Used for resolving
 * `{group.token}` references to their literal values.
 */
function buildValueIndex(tokens) {
  const out = {};
  walk(tokens, '', (path, value) => { out[path] = value; });
  return out;
}

function walk(obj, prefix, visit) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      if ('$value' in v) {
        visit(path, v.$value);
      } else {
        walk(v, path, visit);
      }
    }
  }
}

/**
 * Flatten a DTCG sub-tree into a Tailwind-shaped object. Each leaf
 * token becomes a key with its resolved $value.
 */
function flatten(subtree, resolveRef) {
  const out = {};
  walk(subtree, '', (path, value) => {
    out[path] = resolveRef(value);
  });
  return out;
}

/**
 * Resolve a DTCG reference like `{color.primary}` to its literal
 * value via the index. Non-reference values pass through.
 */
function resolveReference(value, valueByPath) {
  if (typeof value !== 'string') return value;
  const m = value.match(TOKEN_REF_RX);
  if (!m) return value;
  const referenced = valueByPath[m[1]];
  if (referenced == null) return value; // unresolvable; leave the ref as-is
  // Recurse — references can chain (e.g. primary-hover → primary)
  return resolveReference(referenced, valueByPath);
}

/**
 * Convenience: produce a complete tailwind.config.js content string
 * with the AppSpec theme.extend injected. Caller can write to disk.
 */
function toTailwindConfig(designTokens, opts = {}) {
  const themeExtend = toTailwindTheme(designTokens);
  const contentGlobs = opts.content || ['./src/**/*.{js,jsx,ts,tsx,html}'];
  return `/** Generated from AppSpec designTokens by @missionhud/appspec-adapter-tailwind */
module.exports = {
  content: ${JSON.stringify(contentGlobs, null, 2)},
  theme: {
    extend: ${JSON.stringify(themeExtend, null, 4)}
  },
  plugins: [],
};
`;
}

module.exports = {
  toTailwindTheme,
  toTailwindConfig,
  TOKEN_REF_RX,
};
