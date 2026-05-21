/**
 * v9 → v10 AppSpec migration.
 *
 * v10 adds the formal schema contract, internal UUIDs with provenance
 * envelopes on every node, soft tombstones, and lifecycle _state. v9
 * was loose JSON with optional _meta. This migrator brings a v9 AppSpec
 * up to v10 conformance:
 *
 *   1. Stamp $schema = "missionhud/appspec/v10.0.0" (legacy
 *      "mockingbird/app-spec/v10.0.0" is accepted on read; new writes
 *      use the missionhud form)
 *   2. Assign a project id if missing (id: "proj_<rand>")
 *   3. Walk every screen, ensure id starts with "screen_", stamp
 *      _provenance with createdBy: "unknown", createdAt: now
 *   4. Same for component instances (id: "comp_*")
 *   5. Move _meta.anchors (and any other Mockingbird-only metadata)
 *      under $extensions["com.mockingbird"]
 *   6. Validate the result against the v10 schema
 *
 * Migration is idempotent — running on an already-v10 spec is a no-op
 * for the structural fields and just re-validates.
 *
 * Returns { spec, warnings, migrated: boolean }.
 */

'use strict';

const { generateId, createProvenance, nowIso } = require('@missionhud/appspec-provenance');
const { SCHEMA_ID, isV10SchemaId } = require('@missionhud/appspec-core');
const { validateAndExpand } = require('@missionhud/appspec-validate');

const UNKNOWN_PROVENANCE = (importedAt) => createProvenance({
  source: 'unknown',
  at: importedAt || nowIso(),
  note: 'migrated from v9 — original source unrecorded',
});

function migrate(input) {
  const warnings = [];
  if (!input || typeof input !== 'object') {
    return { spec: null, warnings: ['input is not an object'], migrated: false };
  }

  // Deep-clone — never mutate the caller's spec.
  const spec = JSON.parse(JSON.stringify(input));
  const importedAt = nowIso();

  // 1. $schema stamp — accept both legacy (mockingbird/app-spec) and
  // canonical (missionhud/appspec) forms on read; always emit canonical
  // on write.
  if (!isV10SchemaId(spec.$schema)) {
    spec.$schema = SCHEMA_ID;
  }

  // 2. Project id
  if (!spec.id || !spec.id.startsWith('proj_')) {
    spec.id = generateId('proj');
  }

  // 3. Identity defaults
  if (!spec.identity || typeof spec.identity !== 'object') {
    spec.identity = { name: 'Untitled App' };
    warnings.push('identity was missing; stamped default name');
  }

  // 4. libraryRefs defaults
  if (!spec.libraryRefs || typeof spec.libraryRefs !== 'object') {
    spec.libraryRefs = { components: 'missionhud-default', icons: 'material-symbols' };
  } else {
    spec.libraryRefs.components = spec.libraryRefs.components || 'missionhud-default';
    spec.libraryRefs.icons = spec.libraryRefs.icons || 'material-symbols';
  }

  // 5. screens.content
  spec.screens = spec.screens || { required: [], content: [] };
  spec.screens.content = Array.isArray(spec.screens.content) ? spec.screens.content : [];

  // 6. Walk every screen + component, stamp provenance + ids
  for (let i = 0; i < spec.screens.content.length; i++) {
    const screen = spec.screens.content[i];
    if (!screen || typeof screen !== 'object') continue;

    if (!screen.id || !screen.id.startsWith('screen_')) {
      const oldId = screen.id;
      screen.id = generateId('screen');
      if (oldId) {
        warnings.push(`screen ${i} id "${oldId}" not v10-formatted; renamed to ${screen.id}`);
      }
    }
    if (!screen._provenance) {
      screen._provenance = UNKNOWN_PROVENANCE(importedAt);
    }

    screen.components = Array.isArray(screen.components) ? screen.components : [];

    // Some v9 specs have screen.sections (legacy v2 mirror). Drop on
    // migration — the v10 contract is components[] only; client-side
    // synthesis to v2 happens elsewhere if needed.
    delete screen.sections;

    for (let j = 0; j < screen.components.length; j++) {
      const comp = screen.components[j];
      if (!comp || typeof comp !== 'object') continue;
      if (!comp.id || !comp.id.startsWith('comp_')) {
        comp.id = generateId('comp');
      }
      if (!comp._provenance) {
        comp._provenance = UNKNOWN_PROVENANCE(importedAt);
      }
    }
  }

  // 7. AppSpec-level _provenance
  if (!spec._provenance) {
    spec._provenance = UNKNOWN_PROVENANCE(importedAt);
  }

  // 8. Move v9 anchors out of contract → $extensions['com.mockingbird']
  spec.$extensions = spec.$extensions || {};
  spec.$extensions['com.mockingbird'] = spec.$extensions['com.mockingbird'] || {};
  if (spec.anchors) {
    spec.$extensions['com.mockingbird'].anchors = spec.anchors;
    delete spec.anchors;
    warnings.push('anchors moved from root → $extensions["com.mockingbird"].anchors');
  }
  if (spec._meta && spec._meta.anchors) {
    spec.$extensions['com.mockingbird'].anchors =
      spec.$extensions['com.mockingbird'].anchors || spec._meta.anchors;
  }
  if (spec._meta) {
    // Carry the rest of _meta into the mockingbird extension namespace —
    // v10 doesn't formalise these but they're useful for Mockingbird's
    // own bookkeeping.
    spec.$extensions['com.mockingbird']._meta = spec._meta;
    delete spec._meta;
  }

  // 8b. Sweep any unknown v9 root fields into $extensions['com.mockingbird'].legacy.
  // v9 had loose root fields (theme, designTokens-as-loose-block, etc.) that
  // v10's schema rejects. Preserve them under the extension namespace so
  // they survive the migration; future cleanups can decide which (if any)
  // get promoted back to core.
  const KNOWN_V10_ROOT = new Set([
    '$schema', 'id', 'identity', 'vision', 'targetUsers', 'designDirection',
    'contentGuidelines', 'libraryRefs', 'designTokens', 'screens', 'userFlows',
    'navigation', 'styleOverrides', '_provenance', '$extensions',
  ]);
  const legacyBag = {};
  let movedLegacy = 0;
  for (const k of Object.keys(spec)) {
    if (!KNOWN_V10_ROOT.has(k)) {
      legacyBag[k] = spec[k];
      delete spec[k];
      movedLegacy++;
    }
  }
  if (movedLegacy > 0) {
    spec.$extensions['com.mockingbird'].legacy =
      Object.assign({}, spec.$extensions['com.mockingbird'].legacy, legacyBag);
    warnings.push(`${movedLegacy} legacy root field${movedLegacy === 1 ? '' : 's'} moved to $extensions["com.mockingbird"].legacy: ${Object.keys(legacyBag).join(', ')}`);
  }

  // 9. Validate result
  const { valid, errors } = validateAndExpand(spec, { mutate: true });
  if (!valid) {
    warnings.push(`v10 validation failed after migration: ${errors.slice(0, 3).map(e => `${e.path}: ${e.message}`).join('; ')}${errors.length > 3 ? '; …' : ''}`);
  }

  return { spec, warnings, migrated: true, valid };
}

module.exports = { migrate };
