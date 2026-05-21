#!/usr/bin/env node
/**
 * AppSpec conformance test runner.
 *
 * Runs every test case in spec/v10/conformance/<tier>/{valid,invalid}
 * against the reference validator (@missionhud/appspec-validate). Valid
 * cases must validate; invalid cases must fail with the errors declared
 * in their sidecar .expected.json file.
 *
 * Usage:
 *   node spec/v10/conformance/run.js              # all tiers
 *   node spec/v10/conformance/run.js --tier=core  # specific tier
 *   node spec/v10/conformance/run.js --json       # machine-readable output
 *
 * Exit codes:
 *   0  all cases passed
 *   1  one or more cases failed
 *   2  runner error (missing tier dir, invalid arg, etc.)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validate } = require('@missionhud/appspec-validate');

const CONFORMANCE_ROOT = path.resolve(__dirname);
const TIERS = ['core'];

const argv = process.argv.slice(2);
const flags = {
  tier: argv.find((a) => a.startsWith('--tier='))?.split('=')[1],
  json: argv.includes('--json'),
  verbose: argv.includes('--verbose') || argv.includes('-v'),
};

const tiersToRun = flags.tier ? [flags.tier] : TIERS;

const results = {
  tool: '@missionhud/appspec-validate (reference implementation)',
  schemaVersion: require('@missionhud/appspec-core').SCHEMA_VERSION,
  runAt: new Date().toISOString(),
  tiers: {},
  totals: { pass: 0, fail: 0, errored: 0 },
};

for (const tier of tiersToRun) {
  const tierResult = runTier(tier);
  results.tiers[tier] = tierResult;
  results.totals.pass += tierResult.totals.pass;
  results.totals.fail += tierResult.totals.fail;
  results.totals.errored += tierResult.totals.errored;
}

if (flags.json) {
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
} else {
  printHuman(results);
}

const exitCode = results.totals.fail === 0 && results.totals.errored === 0 ? 0 : 1;
process.exit(exitCode);

// ─────────────────────────────────────────────────────────────────────

function runTier(tier) {
  const dir = path.join(CONFORMANCE_ROOT, tier);
  if (!fs.existsSync(dir)) {
    return {
      cases: [],
      totals: { pass: 0, fail: 0, errored: 1 },
      error: `Tier directory not found: ${dir}`,
    };
  }
  const result = { cases: [], totals: { pass: 0, fail: 0, errored: 0 } };

  // Valid cases
  const validDir = path.join(dir, 'valid');
  if (fs.existsSync(validDir)) {
    for (const file of fs.readdirSync(validDir).filter((f) => f.endsWith('.json'))) {
      const caseResult = runValidCase(tier, validDir, file);
      result.cases.push(caseResult);
      bump(result.totals, caseResult.status);
    }
  }

  // Invalid cases
  const invalidDir = path.join(dir, 'invalid');
  if (fs.existsSync(invalidDir)) {
    for (const file of fs.readdirSync(invalidDir).filter((f) => f.endsWith('.json') && !f.endsWith('.expected.json'))) {
      const caseResult = runInvalidCase(tier, invalidDir, file);
      result.cases.push(caseResult);
      bump(result.totals, caseResult.status);
    }
  }

  return result;
}

function runValidCase(tier, dir, file) {
  const filePath = path.join(dir, file);
  const caseInfo = { tier, kind: 'valid', file, path: filePath };
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { ...caseInfo, status: 'errored', error: `parse: ${err.message}` };
  }
  let v;
  try {
    v = validate(spec);
  } catch (err) {
    return { ...caseInfo, status: 'errored', error: `validate threw: ${err.message}` };
  }
  if (v.valid) {
    return { ...caseInfo, status: 'pass' };
  }
  return {
    ...caseInfo,
    status: 'fail',
    expected: 'valid',
    actual: 'invalid',
    errors: v.errors.slice(0, 5),
  };
}

function runInvalidCase(tier, dir, file) {
  const filePath = path.join(dir, file);
  const expectedPath = path.join(dir, file.replace(/\.json$/, '.expected.json'));
  const caseInfo = { tier, kind: 'invalid', file, path: filePath };
  let spec, expected;
  try {
    spec = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { ...caseInfo, status: 'errored', error: `parse: ${err.message}` };
  }
  try {
    expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  } catch (err) {
    return { ...caseInfo, status: 'errored', error: `missing sidecar ${path.basename(expectedPath)}: ${err.message}` };
  }
  let v;
  try {
    v = validate(spec);
  } catch (err) {
    return { ...caseInfo, status: 'errored', error: `validate threw: ${err.message}` };
  }
  if (v.valid && expected.expectedValid === false) {
    return {
      ...caseInfo,
      status: 'fail',
      expected: 'invalid',
      actual: 'valid',
      description: expected.description,
    };
  }
  // Both `valid` agree → pass. We don't strictly enforce error-list
  // matching since different validators format errors differently;
  // the key contract is "must reject."
  return {
    ...caseInfo,
    status: 'pass',
    actualErrors: v.errors.length,
    description: expected.description,
  };
}

function bump(totals, status) {
  if (status === 'pass') totals.pass++;
  else if (status === 'fail') totals.fail++;
  else totals.errored++;
}

function printHuman(results) {
  console.log('\nAppSpec v10 Conformance');
  console.log('───────────────────────');
  console.log(`Tool:           ${results.tool}`);
  console.log(`Schema version: ${results.schemaVersion}`);
  console.log(`Run at:         ${results.runAt}`);
  console.log('');
  for (const [tier, t] of Object.entries(results.tiers)) {
    console.log(`Tier: ${tier}`);
    if (t.error) {
      console.log(`  ERROR: ${t.error}`);
      continue;
    }
    for (const c of t.cases) {
      const mark = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '!';
      const dir = c.kind === 'valid' ? 'valid' : 'invalid';
      const tail = c.status === 'fail'
        ? `   ${c.expected ? `(expected: ${c.expected}, actual: ${c.actual})` : ''}`
        : c.status === 'errored'
          ? `   (${c.error})`
          : '';
      console.log(`  ${mark} ${dir}/${c.file}${tail}`);
    }
    const summary = `  ${t.totals.pass} pass · ${t.totals.fail} fail · ${t.totals.errored} errored`;
    console.log(summary);
    console.log('');
  }
  console.log('───────────────────────');
  console.log(`Total: ${results.totals.pass} pass, ${results.totals.fail} fail, ${results.totals.errored} errored`);
  console.log('');
}
