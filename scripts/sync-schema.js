#!/usr/bin/env node
/**
 * Sync the canonical schema (spec/v10/schema.json) into each package
 * that bundles a copy. Run after editing the canonical schema, or in
 * CI to verify no drift.
 *
 * Why bundle: published npm packages must be self-contained. Each
 * package that needs the schema (@missionhud/appspec-core, validate,
 * migrate, lint) ships its own copy. This script keeps them in sync.
 *
 * Usage:
 *   node scripts/sync-schema.js          # rewrite bundled copies
 *   node scripts/sync-schema.js --check  # exit 1 if any are out of date (CI mode)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.join(ROOT, 'spec', 'v10', 'schema.json');

// Packages that bundle the schema directly. Other packages (lint,
// migrate, patch) consume the schema transitively through
// @missionhud/appspec-core and don't need their own copy.
const TARGETS = [
  'core',
  'validate',
];

const CHECK = process.argv.includes('--check');

const canonical = fs.readFileSync(CANONICAL, 'utf8');
let drift = 0;
let written = 0;

for (const pkg of TARGETS) {
  const dest = path.join(ROOT, 'packages', pkg, 'schema.json');
  if (!fs.existsSync(path.dirname(dest))) {
    if (CHECK) {
      console.log(`  · ${pkg}: package not present yet, skipping`);
    }
    continue;
  }
  let current = null;
  if (fs.existsSync(dest)) current = fs.readFileSync(dest, 'utf8');
  if (current === canonical) {
    console.log(`  ✓ ${pkg}: already in sync`);
    continue;
  }
  if (CHECK) {
    console.log(`  ✗ ${pkg}: OUT OF SYNC`);
    drift++;
    continue;
  }
  fs.writeFileSync(dest, canonical);
  console.log(`  → ${pkg}: rewrote schema.json`);
  written++;
}

if (CHECK && drift > 0) {
  console.error(`\nDrift detected on ${drift} package(s). Run 'npm run sync-schema' to fix.`);
  process.exit(1);
}
console.log(`\n${CHECK ? 'OK' : `wrote ${written} package(s)`}`);
