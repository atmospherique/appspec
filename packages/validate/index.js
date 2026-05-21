/**
 * @missionhud/appspec-validate
 *
 * Compiles the AppSpec v10 JSON Schema once at module load and exposes:
 *   - validate(spec) → { valid, errors }
 *   - validateAndExpand(spec, opts) → { valid, errors, spec, expanded }
 *     where bare component slugs are first expanded to qualified form
 *
 * Ajv strict mode is disabled because the v10 schema uses Draft 2020-12
 * keywords (oneOf with const, propertyNames, etc.) that trigger strict
 * warnings without affecting validation correctness.
 */

'use strict';

const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const { SCHEMA } = require('@missionhud/appspec-core');
const { expandSlugs } = require('./expand-slugs');

let _validate = null;

function getValidator() {
  if (_validate) return _validate;
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,   // collect all errors, not just the first
    verbose: true,     // include schema path + data path in errors
  });
  addFormats(ajv);
  _validate = ajv.compile(SCHEMA);
  return _validate;
}

/**
 * Validate an AppSpec against the v10 schema.
 *
 * @param {object} spec
 * @returns {{ valid: boolean, errors: Array<{path: string, message: string, schemaPath: string, params: object}> }}
 */
function validate(spec) {
  const v = getValidator();
  const valid = v(spec);
  if (valid) return { valid: true, errors: [] };
  const errors = (v.errors || []).map(e => ({
    path: e.instancePath || '(root)',
    message: e.message,
    schemaPath: e.schemaPath,
    params: e.params,
  }));
  return { valid: false, errors };
}

/**
 * Slug-expansion pass + validation. Per the spec, producers MAY write
 * bare componentRef values ("HeroCard"); this pass qualifies them via
 * the AppSpec's libraryRefs.components default before validating.
 *
 * @param {object} spec - AppSpec, possibly with bare slugs
 * @param {object} [opts]
 * @param {boolean} [opts.mutate=true] - apply expansion in place; false deep-clones first
 * @returns {{ valid: boolean, errors: Array, spec: object, expanded: number }}
 */
function validateAndExpand(spec, opts = {}) {
  const mutate = opts.mutate !== false;
  const target = mutate ? spec : JSON.parse(JSON.stringify(spec));
  const { expanded } = expandSlugs(target);
  const { valid, errors } = validate(target);
  return { valid, errors, spec: target, expanded };
}

module.exports = {
  validate,
  validateAndExpand,
  getValidator,
  expandSlugs,
};
