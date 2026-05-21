/**
 * @missionhud/appspec-cli — programmatic API
 *
 * Most callers use the `appspec` binary directly. This module exposes
 * the same command implementations for programmatic use (e.g. embedding
 * AppSpec validation into your own CLI / build script).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const core = require('@missionhud/appspec-core');
const provenance = require('@missionhud/appspec-provenance');
const { validate, validateAndExpand } = require('@missionhud/appspec-validate');
const { lint } = require('@missionhud/appspec-lint');
const { migrate } = require('@missionhud/appspec-migrate');

// Tag for chalk-less coloring. The CLI binary uses these; programmatic
// callers can ignore by setting NO_COLOR=1 in their env.
const NO_COLOR = process.env.NO_COLOR === '1' || !process.stdout.isTTY;
const C = NO_COLOR
  ? { red: (s) => s, green: (s) => s, yellow: (s) => s, dim: (s) => s, bold: (s) => s }
  : {
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
    };

function readJson(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(path.resolve(filePath), JSON.stringify(data, null, 2) + '\n');
}

// ─────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────

function cmdValidate(filePath, opts = {}) {
  const spec = readJson(filePath);
  const result = opts.expand ? validateAndExpand(spec) : validate(spec);
  if (result.valid) {
    console.log(C.green('✓') + ` ${filePath} is valid`
      + (opts.expand && result.expanded > 0 ? C.dim(` (${result.expanded} bare slugs expanded)`) : ''));
    return 0;
  }
  console.log(C.red('✗') + ` ${filePath} — ${result.errors.length} error(s)`);
  for (const err of result.errors) {
    console.log(`  ${C.red('•')} ${C.dim(err.path)} ${err.message}`);
  }
  return 1;
}

function cmdLint(filePath) {
  const spec = readJson(filePath);
  const result = lint(spec);
  const errors = result.summary.errors;
  const warnings = result.summary.warnings;
  if (result.valid && warnings === 0) {
    console.log(C.green('✓') + ` ${filePath} is lint-clean`);
    return 0;
  }
  const status = result.valid ? C.yellow('!') : C.red('✗');
  console.log(`${status} ${filePath} — ${C.red(errors + ' error(s)')}, ${C.yellow(warnings + ' warning(s)')}`);
  for (const issue of result.issues) {
    const sev = issue.severity === 'error' ? C.red('•') : C.yellow('•');
    console.log(`  ${sev} ${C.dim(issue.path)} ${issue.message}`);
  }
  return result.valid ? 0 : 1;
}

function cmdCheck(filePath) {
  const v = cmdValidate(filePath);
  const l = cmdLint(filePath);
  return Math.max(v, l);
}

function cmdMigrate(filePath, opts = {}) {
  const input = readJson(filePath);
  const result = migrate(input);
  if (!result.migrated) {
    console.log(C.red('✗') + ' migration failed:', result.warnings.join(', '));
    return 1;
  }
  if (result.warnings.length > 0) {
    console.log(C.yellow('!') + ' migration warnings:');
    for (const w of result.warnings) console.log(`  ${C.yellow('•')} ${w}`);
  }
  if (opts.inPlace) {
    writeJson(filePath, result.spec);
    console.log(C.green('✓') + ` migrated in place → ${filePath}`);
  } else if (opts.out) {
    writeJson(opts.out, result.spec);
    console.log(C.green('✓') + ` migrated → ${opts.out}`);
  } else {
    process.stdout.write(JSON.stringify(result.spec, null, 2) + '\n');
  }
  return 0;
}

function cmdInfo() {
  console.log(C.bold('AppSpec'));
  console.log(`  schema id:        ${C.green(core.SCHEMA_ID)}`);
  console.log(`  legacy schema id: ${C.dim(core.LEGACY_SCHEMA_ID)}`);
  console.log(`  schema version:   ${core.SCHEMA_VERSION}`);
  console.log('');
  console.log(C.bold('Packages installed'));
  const pkgs = [
    ['@missionhud/appspec-core',       safeVersion('@missionhud/appspec-core')],
    ['@missionhud/appspec-provenance', safeVersion('@missionhud/appspec-provenance')],
    ['@missionhud/appspec-validate',   safeVersion('@missionhud/appspec-validate')],
    ['@missionhud/appspec-lint',       safeVersion('@missionhud/appspec-lint')],
    ['@missionhud/appspec-migrate',    safeVersion('@missionhud/appspec-migrate')],
    ['@missionhud/appspec-cli',        safeVersion('@missionhud/appspec-cli')],
  ];
  for (const [name, version] of pkgs) {
    console.log(`  ${name} ${C.dim(version || '(not found)')}`);
  }
  console.log('');
  console.log(C.bold('Valid sources'));
  console.log('  ' + [...provenance.VALID_SOURCES].join(', '));
  return 0;
}

function safeVersion(pkgName) {
  try {
    return require(`${pkgName}/package.json`).version;
  } catch (_) {
    return null;
  }
}

module.exports = {
  cmdValidate,
  cmdLint,
  cmdCheck,
  cmdMigrate,
  cmdInfo,
  readJson,
  writeJson,
  C,
};
