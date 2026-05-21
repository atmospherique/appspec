/**
 * @missionhud/appspec-patch
 *
 * Pure RFC 6902 JSON Patch helpers for AppSpec v10. No database
 * coupling — these functions operate on in-memory specs. Productized
 * patch lifecycles (Postgres-backed propose/apply/reject with version
 * concurrency) are downstream and product-specific.
 *
 * What this package gives you:
 *   - applyPatchToSpec(spec, operations, opts)  → apply + touch provenance
 *   - touchAffectedNodes(spec, operations, opts) → touch per-node provenance
 *   - findProvenanceAncestor(path)              → walk up to nearest node
 *   - isStructurallyAutoApplicable({operations, proposedBy}) → heuristic
 *   - AUTO_APPLY_TRUSTED_SOURCES, AUTO_APPLY_MAX_OPS, DESTRUCTIVE_OPS
 *   - generatePatchId() → 'patch_<hex>'
 *
 * Built on top of fast-json-patch (RFC 6902).
 */

'use strict';

const crypto = require('crypto');
const fastJsonPatch = require('fast-json-patch');
const { createProvenance, touchProvenance } = require('@missionhud/appspec-provenance');

// ─────────────────────────────────────────────────────────────────────
// Auto-apply heuristic constants
// ─────────────────────────────────────────────────────────────────────

const AUTO_APPLY_TRUSTED_SOURCES = new Set([
  'mockingbird-ai',
  'preset-load',
  'figma-import',
]);

const AUTO_APPLY_MAX_OPS = 3;
const DESTRUCTIVE_OPS = new Set(['remove', 'move']);

function generatePatchId() {
  return 'patch_' + crypto.randomBytes(6).toString('hex');
}

/**
 * Decide whether a patch is safe to auto-apply without human review.
 * Pure structural inspection — does not look at the spec being patched
 * or consult any AI.
 *
 * Heuristic: ≤3 ops, none destructive (no remove/move), from a trusted
 * producer source. Consumers may apply tighter or looser rules.
 *
 * @param {object} args
 * @param {Array} args.operations - RFC 6902 ops
 * @param {string} args.proposedBy - one of the appspec-provenance VALID_SOURCES
 * @returns {boolean}
 */
function isStructurallyAutoApplicable({ operations, proposedBy }) {
  if (!Array.isArray(operations)) return false;
  if (operations.length === 0 || operations.length > AUTO_APPLY_MAX_OPS) return false;
  if (!AUTO_APPLY_TRUSTED_SOURCES.has(proposedBy)) return false;
  for (const op of operations) {
    if (!op || typeof op !== 'object') return false;
    if (DESTRUCTIVE_OPS.has(op.op)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// Per-node provenance touch
// ─────────────────────────────────────────────────────────────────────

/**
 * Given a JSON Pointer path that some patch operation targeted, return
 * the path of the nearest ancestor that has a `_provenance` envelope.
 * Returns null if no provenance-bearing ancestor exists (paths under
 * /identity, /vision, /designTokens — leaf metadata, not nodes).
 *
 * Provenance-bearing node patterns (per v10 schema):
 *   /screens/content/<n>                        → Screen
 *   /screens/content/<n>/components/<m>         → ComponentInstance
 *   /assets/<key>                               → AssetRef
 *
 * Deeper paths walk up to the nearest match.
 *
 * @param {string} jsonPointerPath
 * @returns {string|null}
 */
function findProvenanceAncestor(jsonPointerPath) {
  if (typeof jsonPointerPath !== 'string' || !jsonPointerPath.startsWith('/')) {
    return null;
  }
  const tokens = jsonPointerPath.split('/').slice(1); // drop leading ''

  if (tokens[0] === 'screens' && tokens[1] === 'content' && tokens.length >= 3) {
    if (tokens[3] === 'components' && tokens.length >= 5) {
      return `/screens/content/${tokens[2]}/components/${tokens[4]}`;
    }
    return `/screens/content/${tokens[2]}`;
  }

  if (tokens[0] === 'assets' && tokens.length >= 2) {
    return `/assets/${tokens[1]}`;
  }

  return null;
}

/**
 * After patch operations have been applied to newSpec, touch the
 * `_provenance` envelope of every node whose subtree was modified.
 * Walks each operation's path up to the nearest provenance-bearing
 * ancestor and stamps lastEditedBy/At + appends a sourceTimeline entry.
 *
 * Dedupes — if multiple operations target the same ancestor, that
 * ancestor's provenance is touched once.
 *
 * Creates a fresh _provenance for nodes that exist but never had one —
 * preserves the contract that every provenance-bearing node has the
 * envelope.
 *
 * @param {object} newSpec - spec AFTER patch ops applied
 * @param {Array} operations - the RFC 6902 ops that were applied
 * @param {object} opts
 * @param {string} opts.source - provenance source for the touch
 * @param {string} [opts.note]
 * @returns {string[]} array of ancestor paths that were touched
 */
function touchAffectedNodes(newSpec, operations, { source, note } = {}) {
  if (!Array.isArray(operations)) return [];

  const ancestorPaths = new Set();
  for (const op of operations) {
    if (!op || typeof op.path !== 'string') continue;
    const ancestor = findProvenanceAncestor(op.path);
    if (ancestor) ancestorPaths.add(ancestor);
    // 'move' ops also affect the FROM path's ancestor (the node losing
    // a child also "edited" in some sense).
    if (op.op === 'move' && typeof op.from === 'string') {
      const fromAncestor = findProvenanceAncestor(op.from);
      if (fromAncestor) ancestorPaths.add(fromAncestor);
    }
  }

  const touched = [];
  for (const path of ancestorPaths) {
    const node = fastJsonPatch.getValueByPointer(newSpec, path);
    if (!node || typeof node !== 'object') continue;
    if (!node._provenance) {
      node._provenance = createProvenance({ source, note });
    } else {
      touchProvenance(node._provenance, { source, note });
    }
    touched.push(path);
  }
  return touched;
}

// ─────────────────────────────────────────────────────────────────────
// Apply
// ─────────────────────────────────────────────────────────────────────

/**
 * Apply RFC 6902 operations to an AppSpec and touch the provenance of
 * every affected node (root + each ancestor whose subtree was changed).
 * Pure — does not write to any storage. Returns the new spec.
 *
 * @param {object} spec - the base spec
 * @param {Array} operations - RFC 6902 patch ops
 * @param {object} opts
 * @param {string} opts.source - provenance source (one of VALID_SOURCES)
 * @param {string} [opts.note] - human-readable annotation for the audit trail
 * @param {boolean} [opts.mutate=false] - apply in place vs deep-clone first
 * @returns {{ newSpec: object, touchedNodes: string[] }}
 */
function applyPatchToSpec(spec, operations, { source, note, mutate = false } = {}) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('applyPatchToSpec: spec is required');
  }
  if (!Array.isArray(operations)) {
    throw new Error('applyPatchToSpec: operations must be an array');
  }
  if (!source) {
    throw new Error('applyPatchToSpec: opts.source is required');
  }

  // Validate the operations document up front (catches malformed ops
  // before we modify anything).
  fastJsonPatch.validate(operations);

  // Apply (deep-clone unless caller opted into mutation).
  const result = fastJsonPatch.applyPatch(
    mutate ? spec : fastJsonPatch.deepClone(spec),
    operations,
    /* validate */ true,
    /* mutate */ mutate
  );
  const newSpec = result.newDocument;

  // Root provenance touch.
  if (!newSpec._provenance) {
    newSpec._provenance = createProvenance({ source, note });
  } else {
    touchProvenance(newSpec._provenance, { source, note });
  }

  // Per-node provenance touch for every affected ancestor.
  const touchedNodes = touchAffectedNodes(newSpec, operations, { source, note });

  return { newSpec, touchedNodes };
}

// ─────────────────────────────────────────────────────────────────────
// Streaming patch compiler — for LLM-emitted patches over time
// ─────────────────────────────────────────────────────────────────────

/**
 * Create a streaming patch compiler. Useful when an LLM (or any
 * incremental producer) emits RFC 6902 patch operations over time and
 * you want a runtime to repaint progressively as ops arrive.
 *
 * Inspired by Vercel json-render's `createSpecStreamCompiler` but
 * operates over the existing @missionhud/appspec-patch lifecycle, so
 * provenance touching, auto-apply heuristics, and validation hooks all
 * apply.
 *
 * Usage:
 *   const stream = createPatchStream(initialSpec, {
 *     source: 'mockingbird-ai',
 *     onUpdate: (newSpec, newOps) => renderer.update(newSpec)
 *   });
 *
 *   // As ops arrive from an LLM, MCP server, etc:
 *   stream.applyOps([{ op: 'replace', path: '/screens/content/0/components/0/properties/title', value: 'Hi' }]);
 *   stream.applyOps([{ op: 'add',     path: '/screens/content/0/components/1', value: {...} }]);
 *
 *   // Get current state at any time:
 *   const current = stream.getCurrent();
 *
 *   // Flush + finalize when stream is done:
 *   const final = stream.flush();
 *
 * @param {object} initialSpec - the starting AppSpec
 * @param {object} opts
 * @param {string} opts.source - provenance source for all incoming patches
 * @param {(spec: object, ops: Array) => void} [opts.onUpdate] - callback after each ops batch
 * @param {(error: Error, ops: Array) => void} [opts.onError] - callback on per-batch failure
 * @returns {{ applyOps: function, getCurrent: function, flush: function, getOperationsLog: function }}
 */
function createPatchStream(initialSpec, opts = {}) {
  const { source, onUpdate, onError } = opts;
  if (!source) throw new Error('createPatchStream: opts.source is required');

  let current = fastJsonPatch.deepClone(initialSpec);
  const operationsLog = [];

  /**
   * Apply a batch of RFC 6902 ops to the current spec. Failures are
   * caught per-batch — invalid ops don't kill the stream. Each
   * successful batch fires onUpdate.
   */
  function applyOps(operations, batchOpts = {}) {
    if (!Array.isArray(operations)) {
      const err = new Error('applyOps: operations must be an array');
      if (onError) onError(err, operations); else throw err;
      return { applied: false, error: err };
    }
    if (operations.length === 0) {
      return { applied: true, newSpec: current, touchedNodes: [] };
    }

    try {
      const result = applyPatchToSpec(current, operations, {
        source,
        note: batchOpts.note,
        mutate: false,
      });
      current = result.newSpec;
      operationsLog.push({
        at: new Date().toISOString(),
        operations,
        note: batchOpts.note,
        touchedNodes: result.touchedNodes,
      });
      if (onUpdate) onUpdate(current, operations);
      return { applied: true, newSpec: current, touchedNodes: result.touchedNodes };
    } catch (err) {
      if (onError) onError(err, operations);
      else throw err;
      return { applied: false, error: err };
    }
  }

  function getCurrent() {
    return current;
  }

  /**
   * Finalize the stream: return current state + total operation log.
   * Useful for persisting the final spec + a complete audit of every
   * patch applied during the stream's lifetime.
   */
  function flush() {
    return {
      spec: current,
      operationsLog: [...operationsLog],
      totalBatches: operationsLog.length,
      totalOps: operationsLog.reduce((acc, b) => acc + b.operations.length, 0),
    };
  }

  function getOperationsLog() {
    return [...operationsLog];
  }

  return { applyOps, getCurrent, flush, getOperationsLog };
}

module.exports = {
  applyPatchToSpec,
  touchAffectedNodes,
  findProvenanceAncestor,
  isStructurallyAutoApplicable,
  generatePatchId,
  createPatchStream,
  AUTO_APPLY_TRUSTED_SOURCES,
  AUTO_APPLY_MAX_OPS,
  DESTRUCTIVE_OPS,
};
