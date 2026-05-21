/**
 * @missionhud/appspec-core
 *
 * Loads the canonical AppSpec v10 JSON Schema and exports identifier
 * constants + small helpers every other @missionhud/appspec-* package
 * depends on.
 *
 * The schema file (schema.json in this directory) is a bundled copy of
 * the canonical spec/v10/schema.json in the source repo. Sync via
 * scripts/sync-schema.js in the monorepo.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const SCHEMA_PATH = path.join(__dirname, 'schema.json');
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const SCHEMA_VERSION = SCHEMA.version;

// Canonical schema identifier for new writes.
const SCHEMA_ID = `missionhud/appspec/v${SCHEMA_VERSION}`;

// Legacy identifier accepted on read. Pre-rename specs in the wild
// carry this. New writes never emit it.
const LEGACY_SCHEMA_ID = `mockingbird/app-spec/v${SCHEMA_VERSION}`;

/**
 * Does the given $schema string identify a v10-shape AppSpec under any
 * accepted prefix? Use this in any consumer code that needs to gate on
 * "is this a v10 spec?" without caring which identifier flavour shipped.
 *
 * @param {string} s - the $schema value from a spec
 * @returns {boolean}
 */
function isV10SchemaId(s) {
  if (typeof s !== 'string') return false;
  return s.startsWith('missionhud/appspec/v10.')
      || s.startsWith('mockingbird/app-spec/v10.');
}

/**
 * Re-load the schema from disk. Mostly useful in tests where the
 * monorepo's sync-schema script has just rewritten the bundled copy.
 * Production code should use the cached SCHEMA export.
 */
function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

module.exports = {
  SCHEMA,
  SCHEMA_VERSION,
  SCHEMA_ID,
  LEGACY_SCHEMA_ID,
  isV10SchemaId,
  loadSchema,
};
