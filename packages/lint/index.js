/**
 * AppSpec v10 linter — cross-reference integrity checks.
 *
 * The JSON Schema validates SHAPE. The linter validates INTEGRITY:
 *   - FlowStep.screenId references a real Screen
 *   - FlowStep.edgesTo references real steps within the same flow
 *   - Flow.start exists in flow's steps
 *   - Navigation.items[].screenId references real screens
 *   - ComponentInstance properties referencing assetId find the asset
 *   - TokenRefs in layout / properties resolve to defined designTokens paths
 *   - AssetRefs missing alt text for visible kinds (a11y warning)
 *   - References to tombstoned entities (warning)
 *
 * Both validator AND linter must pass before AppSpec is shipped.
 *
 * Returns { valid, issues, summary }. valid is true iff zero errors;
 * warnings don't block. Producers SHOULD fix warnings before shipping
 * but consumers MAY accept warning-only specs.
 */

'use strict';

const VISIBLE_ASSET_KINDS = new Set([
  'image', 'vector', 'lottie', 'gif', 'video', 'video-embed',
]);

const TOKEN_REF_RX = /^\{([a-z]+(?:\.[a-z0-9_-]+)+)\}$/;

function lint(spec) {
  const issues = [];

  if (!spec || typeof spec !== 'object') {
    return {
      valid: false,
      issues: [{ severity: 'error', path: '/', message: 'spec is not an object', kind: 'invalid-input' }],
      summary: { errors: 1, warnings: 0 },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Build lookup tables
  // ─────────────────────────────────────────────────────────────────────

  const screensById = Object.create(null);
  const componentsById = Object.create(null);
  const flowStepsByFlowId = Object.create(null);
  const assetsById = spec.assets || Object.create(null);
  const tokenPaths = buildTokenPaths(spec.designTokens || {});

  for (const screen of (spec.screens && spec.screens.content) || []) {
    if (screen && screen.id) {
      screensById[screen.id] = screen;
      for (const comp of (screen.components || [])) {
        if (comp && comp.id) componentsById[comp.id] = comp;
      }
    }
  }
  for (const flow of spec.userFlows || []) {
    if (!flow || !flow.id) continue;
    flowStepsByFlowId[flow.id] = Object.create(null);
    for (const step of flow.steps || []) {
      if (step && step.id) flowStepsByFlowId[flow.id][step.id] = step;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Rule 1: Flow.start exists in flow's steps
  // ─────────────────────────────────────────────────────────────────────

  for (const flow of spec.userFlows || []) {
    if (!flow || !flow.start) continue;
    if (!flowStepsByFlowId[flow.id] || !flowStepsByFlowId[flow.id][flow.start]) {
      issues.push({
        severity: 'error',
        path: `/userFlows/<flow:${flow.id}>/start`,
        message: `Flow.start "${flow.start}" not found in flow's steps[]`,
        kind: 'dangling-reference',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Rule 2: FlowStep.screenId for kind='screen' references a real Screen
  // Rule 3: FlowStep.edgesTo[] references real steps in the same flow
  // ─────────────────────────────────────────────────────────────────────

  for (const flow of spec.userFlows || []) {
    if (!flow || !Array.isArray(flow.steps)) continue;
    const stepSet = flowStepsByFlowId[flow.id] || {};
    for (const step of flow.steps) {
      if (step.kind === 'screen' && step.screenId) {
        const target = screensById[step.screenId];
        if (!target) {
          issues.push({
            severity: 'error',
            path: `/userFlows/<flow:${flow.id}>/steps/<step:${step.id}>/screenId`,
            message: `FlowStep references screen "${step.screenId}" but no such screen exists`,
            kind: 'dangling-reference',
          });
        } else if (target._provenance && target._provenance._tombstone) {
          issues.push({
            severity: 'warning',
            path: `/userFlows/<flow:${flow.id}>/steps/<step:${step.id}>/screenId`,
            message: `FlowStep references tombstoned screen "${step.screenId}" — resolve the tombstone or update the flow`,
            kind: 'tombstone-reference',
          });
        }
      }
      for (const targetId of step.edgesTo || []) {
        if (!stepSet[targetId]) {
          issues.push({
            severity: 'error',
            path: `/userFlows/<flow:${flow.id}>/steps/<step:${step.id}>/edgesTo`,
            message: `FlowStep edge target "${targetId}" not found in this flow's steps`,
            kind: 'dangling-reference',
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Rule 4: Navigation.items[].screenId references real screens
  // ─────────────────────────────────────────────────────────────────────

  if (spec.navigation && Array.isArray(spec.navigation.items)) {
    spec.navigation.items.forEach((item, i) => {
      if (item && item.screenId && !screensById[item.screenId]) {
        issues.push({
          severity: 'error',
          path: `/navigation/items/${i}/screenId`,
          message: `Navigation item references screen "${item.screenId}" but no such screen exists`,
          kind: 'dangling-reference',
        });
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Rule 5: ComponentInstance.properties.*.assetId resolves to registry
  // Rule 6: TokenRefs in properties + layout resolve to defined tokens
  // ─────────────────────────────────────────────────────────────────────

  for (const screen of (spec.screens && spec.screens.content) || []) {
    for (let i = 0; i < (screen.components || []).length; i++) {
      const comp = screen.components[i];
      const basePath = `/screens/content/<screen:${screen.id}>/components/${i}`;
      walkComponentForRefs(comp, basePath, {
        assetsById,
        tokenPaths,
        screensById,
        onIssue: (issue) => issues.push(issue),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Rule 7: AssetRef alt text for visible kinds (a11y warning)
  // ─────────────────────────────────────────────────────────────────────

  for (const [assetId, asset] of Object.entries(assetsById)) {
    if (!asset || typeof asset !== 'object') continue;
    if (VISIBLE_ASSET_KINDS.has(asset.kind) && !asset.alt) {
      issues.push({
        severity: 'warning',
        path: `/assets/${assetId}/alt`,
        message: `Visible asset (${asset.kind}) is missing alt text — required for accessibility`,
        kind: 'missing-alt-text',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Rule 8: Unused screens (no flow references them, not in navigation,
  // not the start screen)
  // Warning only — sometimes draft screens exist before being wired up.
  // ─────────────────────────────────────────────────────────────────────

  const referencedScreens = new Set();
  for (const flow of spec.userFlows || []) {
    for (const step of flow.steps || []) {
      if (step.kind === 'screen' && step.screenId) referencedScreens.add(step.screenId);
    }
  }
  for (const item of (spec.navigation && spec.navigation.items) || []) {
    if (item.screenId) referencedScreens.add(item.screenId);
  }
  for (const screenId of Object.keys(screensById)) {
    if (referencedScreens.size > 0 && !referencedScreens.has(screenId)) {
      const screen = screensById[screenId];
      // Skip placeholder / skeleton screens — those are intentionally unwired.
      if (screen._state === 'placeholder' || screen._state === 'skeleton') continue;
      issues.push({
        severity: 'warning',
        path: `/screens/content/<screen:${screenId}>`,
        message: `Screen "${screen.name || screenId}" not referenced by any flow or navigation — orphaned`,
        kind: 'orphaned-screen',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  return {
    valid: errors === 0,
    issues,
    summary: { errors, warnings },
  };
}

/**
 * Walk a designTokens object and return a Set of every defined token
 * path. A path is defined when its node has a $value property (DTCG
 * convention).
 *
 * Example: { color: { primary: { $value: "#000" } } } → { "color.primary" }
 */
function buildTokenPaths(designTokens) {
  const paths = new Set();
  function walk(obj, prefix) {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$')) continue; // skip $type/$value/$extensions/$description
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') {
        if ('$value' in v) {
          paths.add(path);
        } else {
          walk(v, path);
        }
      }
    }
  }
  walk(designTokens, '');
  return paths;
}

/**
 * Walk a ComponentInstance recursively, checking for:
 *  - assetId references in properties → must exist in registry
 *  - token refs anywhere → must resolve to a defined token path
 *  - tombstone-referenced screens (via navigation/flow indirection)
 *
 * Recurses into nested instance-swap properties + items[].
 */
function walkComponentForRefs(comp, basePath, ctx) {
  if (!comp || typeof comp !== 'object') return;

  // Check assetId references + token refs in properties
  if (comp.properties && typeof comp.properties === 'object') {
    walkPropertyValue(comp.properties, `${basePath}/properties`, ctx);
  }

  // Layout: token refs in gap, padding
  if (comp.layout && typeof comp.layout === 'object') {
    walkPropertyValue(comp.layout, `${basePath}/layout`, ctx);
  }

  // Recurse into items (which are property bags or sub-instances)
  if (Array.isArray(comp.items)) {
    comp.items.forEach((item, i) => {
      if (item && typeof item === 'object') {
        if (item.componentRef) {
          // Nested ComponentInstance — recurse
          walkComponentForRefs(item, `${basePath}/items/${i}`, ctx);
        } else {
          // Plain property bag
          walkPropertyValue(item, `${basePath}/items/${i}`, ctx);
        }
      }
    });
  }
}

/**
 * Walk an arbitrary value (object / array / scalar) looking for:
 *  - { assetId: "asset_..." } shapes → check against ctx.assetsById
 *  - String values matching TOKEN_REF_RX → check against ctx.tokenPaths
 *  - Nested ComponentInstance shapes (with componentRef) → recurse
 */
function walkPropertyValue(value, path, ctx) {
  if (value == null) return;
  if (typeof value === 'string') {
    const m = value.match(TOKEN_REF_RX);
    if (m && ctx.tokenPaths.size > 0 && !ctx.tokenPaths.has(m[1])) {
      ctx.onIssue({
        severity: 'error',
        path,
        message: `Token reference "${value}" not defined in designTokens`,
        kind: 'undefined-token',
      });
    }
    return;
  }
  if (typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((v, i) => walkPropertyValue(v, `${path}/${i}`, ctx));
    return;
  }

  // Object — check for special shapes
  if (typeof value.assetId === 'string') {
    if (!ctx.assetsById[value.assetId]) {
      ctx.onIssue({
        severity: 'error',
        path: `${path}/assetId`,
        message: `References asset "${value.assetId}" but no such asset in registry`,
        kind: 'dangling-asset-reference',
      });
    } else {
      const asset = ctx.assetsById[value.assetId];
      if (asset._provenance && asset._provenance._tombstone) {
        ctx.onIssue({
          severity: 'warning',
          path: `${path}/assetId`,
          message: `References tombstoned asset "${value.assetId}"`,
          kind: 'tombstone-asset-reference',
        });
      }
    }
  }
  if (typeof value.componentRef === 'string') {
    // Nested ComponentInstance — recurse via walkComponentForRefs to
    // pick up its own properties + items
    walkComponentForRefs(value, path, ctx);
    return; // walkComponentForRefs already covered properties/layout/items
  }

  // Plain object — recurse on every entry
  for (const [k, v] of Object.entries(value)) {
    walkPropertyValue(v, `${path}/${k}`, ctx);
  }
}

module.exports = {
  lint,
  buildTokenPaths,
  TOKEN_REF_RX,
  VISIBLE_ASSET_KINDS,
};
