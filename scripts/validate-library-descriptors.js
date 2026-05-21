#!/usr/bin/env node
/**
 * Validate every native library descriptor under spec/v10/libraries/
 * against spec/v10/library-descriptor.schema.json. Used by CI.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020').default || require('ajv/dist/2020');
const addFormats = require('ajv-formats').default || require('ajv-formats');

const SCHEMA = path.resolve(__dirname, '..', 'spec', 'v10', 'library-descriptor.schema.json');
const LIB_DIR = path.resolve(__dirname, '..', 'spec', 'v10', 'libraries');

const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

let failures = 0;
const files = fs.readdirSync(LIB_DIR).filter((f) => f.endsWith('.json')).sort();

for (const file of files) {
  const full = path.join(LIB_DIR, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  const ok = validate(data);
  if (ok) {
    const count = data.components ? Object.keys(data.components).length : 0;
    console.log(`✓ ${file} (${count} components, kind=${data.$kind})`);
  } else {
    failures++;
    console.log(`✗ ${file}`);
    for (const err of validate.errors.slice(0, 10)) {
      console.log(`    ${err.instancePath || '(root)'} — ${err.message}`);
    }
  }
}

console.log('');
console.log(`Total: ${files.length - failures}/${files.length} library descriptors valid.`);
process.exit(failures === 0 ? 0 : 1);
