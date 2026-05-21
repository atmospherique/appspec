/**
 * @missionhud/appspec-adapter-figma
 *
 * Reference adapter for the Figma plugin ↔ AppSpec wire format.
 *
 * What's in scope (open / shippable):
 *   - Wire-format constants (WIRE_KIND_IMPORT, WIRE_KIND_EXPORT)
 *   - validateImportPayload — shape check on incoming Figma plugin data
 *   - validateExportPayload — shape check on outgoing AppSpec-for-Figma data
 *   - walkComponentsTree — visit every Component instance in a screen
 *     (handles nested instance-swap properties + items[] recursion)
 *   - applyComponentRefMapping — given a {from → to} map of componentRef
 *     strings, rewrite the AppSpec's components in place. Used after
 *     an AI mapper resolves local/<Name> → missionhud-default/<Slug>.
 *   - buildExportPayloadFromAppSpec — package an AppSpec for the wire
 *
 * What's NOT in scope (stays product-specific):
 *   - AI-driven componentRef mapping (`aiMapComponentRefs`) — needs an LLM
 *   - AI-driven Figma Variables → DTCG conversion — needs an LLM
 *   - Theme curation / DTCG preset fallback — uses product-specific theme catalogs
 *   - Full buildAppSpecFromImport — depends on consumer-specific
 *     library / theme / v9 adapter resolution; consumers wire those.
 *
 * These constraints mean this package is the wire-format reference; the
 * Mission HUD Designer reference implementation
 * (mockingbird-lab/proxy-server/lib/figma-interop) is the productized
 * consumer. Other adapters (Sketch, Penpot, etc.) can follow the same
 * pattern using these primitives.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────
// Wire format
// ─────────────────────────────────────────────────────────────────────
//
// IMPORT direction (plugin → server):
//
//   {
//     $kind: "mockingbird.figmaExport.v1",
//     fileKey: "abc123…",
//     fileName: "Untitled",
//
//     libraries: [
//       { $id: "ios-18", name: "iOS 18 UI Kit", componentCount: 156 },
//       { $id: "<file-key>", name: "Local Components", componentCount: 8 }
//     ],
//
//     designTokens: { color: {…}, dimension: {…}, … },  // DTCG-shaped
//
//     screens: [
//       {
//         id: "screen_<frame-id>",
//         name: "Dashboard",
//         layout: { /* Auto Layout config */ },
//         components: [
//           {
//             id: "comp_<instance-id>",
//             componentRef: "ios-18/NavBar",
//             variant: { style: "large-title" },
//             properties: { title: "Dashboard", leadingItem: { … } },
//             layout: { mode: "vertical", sizing: { w: 'fill', h: 'hug' }, … }
//           }
//         ]
//       }
//     ]
//   }
//
// EXPORT direction (server → plugin):
//   { $kind: "mockingbird.appSpecForFigma.v1", appSpec: { …v10 AppSpec… } }

const WIRE_KIND_IMPORT = 'mockingbird.figmaExport.v1';
const WIRE_KIND_EXPORT = 'mockingbird.appSpecForFigma.v1';

// ─────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────

/**
 * Shape-check an inbound Figma import payload.
 * @returns {{valid: boolean, issues: string[]}}
 */
function validateImportPayload(payload) {
  const issues = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, issues: ['payload is not an object'] };
  }
  if (payload.$kind !== WIRE_KIND_IMPORT) {
    issues.push(`expected $kind "${WIRE_KIND_IMPORT}", got "${payload.$kind}"`);
  }
  if (!payload.fileKey) issues.push('fileKey missing');
  if (!Array.isArray(payload.screens)) issues.push('screens missing or not an array');
  if (payload.designTokens && typeof payload.designTokens !== 'object') {
    issues.push('designTokens must be an object if present');
  }
  if (payload.libraries && !Array.isArray(payload.libraries)) {
    issues.push('libraries must be an array if present');
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Shape-check an outbound AppSpec-for-Figma payload.
 * @returns {{valid: boolean, issues: string[]}}
 */
function validateExportPayload(payload) {
  const issues = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, issues: ['payload is not an object'] };
  }
  if (payload.$kind !== WIRE_KIND_EXPORT) {
    issues.push(`expected $kind "${WIRE_KIND_EXPORT}", got "${payload.$kind}"`);
  }
  if (!payload.appSpec || typeof payload.appSpec !== 'object') {
    issues.push('appSpec missing or not an object');
  }
  return { valid: issues.length === 0, issues };
}

// ─────────────────────────────────────────────────────────────────────
// Walking helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Walk every ComponentInstance in a flat components[] array AND recurse
 * into nested instance-swap properties + items[]. Calls visit(comp,
 * pathContext) for each one.
 *
 * pathContext provides depth / parent info for visitors that care
 * (e.g. AI mappers that weight top-level slugs differently).
 */
function walkComponentsTree(components, visit, pathContext = []) {
  if (!Array.isArray(components)) return;
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    if (!c || typeof c !== 'object') continue;
    const ctx = [...pathContext, i];
    visit(c, ctx);
    // Recurse into nested instance-swap properties
    if (c.properties && typeof c.properties === 'object') {
      for (const [key, val] of Object.entries(c.properties)) {
        if (val && typeof val === 'object' && val.componentRef) {
          walkComponentsTree([val], visit, [...ctx, 'properties', key]);
        }
      }
    }
    // Recurse into items[]
    if (Array.isArray(c.items)) {
      walkComponentsTree(c.items, visit, [...ctx, 'items']);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// componentRef mapping application
// ─────────────────────────────────────────────────────────────────────

/**
 * Given a {from → to} map of componentRef strings, rewrite every
 * matching componentRef in the AppSpec in place. Used after an
 * AI-driven mapper resolves bare or non-canonical refs like
 * `local/<FigmaName>` → `missionhud-default/<MatchedSlug>`.
 *
 * @param {object} appSpec
 * @param {Object<string, string>} mappings - e.g. { 'local/Card': 'missionhud-default/HeroCard' }
 * @returns {number} count of instances rewritten
 */
function applyComponentRefMapping(appSpec, mappings) {
  if (!appSpec?.screens?.content || !mappings) return 0;
  let count = 0;
  for (const screen of appSpec.screens.content) {
    walkComponentsTree(screen.components || [], (comp) => {
      if (typeof comp.componentRef !== 'string') return;
      if (mappings[comp.componentRef]) {
        comp._provenance = comp._provenance || {};
        comp._provenance.componentRefRewrite = {
          from: comp.componentRef,
          to: mappings[comp.componentRef],
          by: 'figma-adapter-mapping',
        };
        comp.componentRef = mappings[comp.componentRef];
        count++;
      }
    });
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────
// Export packaging
// ─────────────────────────────────────────────────────────────────────

/**
 * Package an AppSpec into the export wire format.
 * @returns {{$kind: string, appSpec: object}}
 */
function buildExportPayloadFromAppSpec(appSpec) {
  return {
    $kind: WIRE_KIND_EXPORT,
    appSpec,
  };
}

module.exports = {
  WIRE_KIND_IMPORT,
  WIRE_KIND_EXPORT,
  validateImportPayload,
  validateExportPayload,
  walkComponentsTree,
  applyComponentRefMapping,
  buildExportPayloadFromAppSpec,
};
