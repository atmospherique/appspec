/**
 * Slug expansion — runs BEFORE schema validation.
 *
 * The schema requires componentRef to be fully qualified
 * (<library>/<Slug>). Producers (humans, AI) often write bare slugs
 * (e.g. "HeroCard"). This pass walks every componentRef in the AppSpec
 * and qualifies bare ones via the AppSpec's libraryRefs.components
 * default.
 *
 *   1. Already qualified (contains "/") → leave alone
 *   2. Bare slug → prefix with default library
 *   3. Stamp the resolution into _provenance.slugResolution for traceability
 *
 * Ambiguity (the same bare slug existing in multiple libraries) is NOT
 * handled here — that's an AI-mapper concern at the producer boundary.
 * This module's qualification is purely deterministic.
 *
 * Mutates in place by default. Returns { expanded: count } for diagnostics.
 */

'use strict';

/**
 * @param {object} spec - AppSpec, possibly with bare componentRef strings
 * @returns {{ expanded: number }}
 */
function expandSlugs(spec) {
  if (!spec || typeof spec !== 'object') return { expanded: 0 };
  const defaultLib = spec.libraryRefs && spec.libraryRefs.components;
  if (!defaultLib) {
    // No default library to qualify with. Schema will reject any bare
    // slugs at validation time; we let it.
    return { expanded: 0 };
  }

  let count = 0;
  for (const screen of (spec.screens && spec.screens.content) || []) {
    walkComponentsDeep(screen.components || [], (comp) => {
      if (!comp || typeof comp.componentRef !== 'string') return;
      if (comp.componentRef.includes('/')) return; // already qualified
      const original = comp.componentRef;
      comp.componentRef = `${defaultLib}/${original}`;
      comp._provenance = comp._provenance || {};
      comp._provenance.slugResolution = {
        originalRef: original,
        resolvedRef: comp.componentRef,
        by: 'default-library',
        confidence: 1.0,
      };
      count++;
    });
  }
  return { expanded: count };
}

/**
 * Walk a flat components[] list AND recurse into nested instance-swap
 * properties + items[] so every Component instance is visited.
 */
function walkComponentsDeep(components, visit) {
  if (!Array.isArray(components)) return;
  for (const c of components) {
    if (!c || typeof c !== 'object') continue;
    visit(c);
    if (c.properties && typeof c.properties === 'object') {
      for (const v of Object.values(c.properties)) {
        if (v && typeof v === 'object' && v.componentRef) {
          walkComponentsDeep([v], visit);
        }
      }
    }
    if (Array.isArray(c.items)) {
      walkComponentsDeep(c.items, visit);
    }
  }
}

module.exports = {
  expandSlugs,
  walkComponentsDeep,
};
