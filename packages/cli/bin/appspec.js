#!/usr/bin/env node
/**
 * `appspec` — Mission HUD AppSpec command-line interface.
 *
 * Usage:
 *   appspec validate <file> [--expand]
 *   appspec lint <file>
 *   appspec check <file>                          # validate + lint
 *   appspec migrate <file> [--out <file> | --in-place]
 *   appspec info
 *   appspec --version | -v
 *   appspec --help    | -h
 */

'use strict';

const path = require('path');
const fs = require('fs');

const {
  cmdValidate,
  cmdLint,
  cmdCheck,
  cmdMigrate,
  cmdInfo,
  C,
} = require('../index');

const argv = process.argv.slice(2);

if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
  printHelp();
  process.exit(0);
}

if (argv[0] === '--version' || argv[0] === '-v') {
  const pkg = require('../package.json');
  console.log(pkg.version);
  process.exit(0);
}

const command = argv[0];
const positional = argv.slice(1).filter((a) => !a.startsWith('-'));
const flags = parseFlags(argv.slice(1));

try {
  let exit = 0;
  switch (command) {
    case 'validate':
      requireFile(positional[0], 'validate');
      exit = cmdValidate(positional[0], { expand: !!flags.expand });
      break;
    case 'lint':
      requireFile(positional[0], 'lint');
      exit = cmdLint(positional[0]);
      break;
    case 'check':
      requireFile(positional[0], 'check');
      exit = cmdCheck(positional[0]);
      break;
    case 'migrate':
      requireFile(positional[0], 'migrate');
      exit = cmdMigrate(positional[0], {
        inPlace: !!flags['in-place'],
        out: flags.out || null,
      });
      break;
    case 'info':
      exit = cmdInfo();
      break;
    default:
      console.error(C.red(`Unknown command: ${command}`));
      printHelp();
      process.exit(2);
  }
  process.exit(exit);
} catch (err) {
  console.error(C.red('Error:'), err.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function requireFile(p, cmd) {
  if (!p) {
    console.error(C.red(`Error: '${cmd}' requires a file argument.`));
    printHelp();
    process.exit(2);
  }
}

function printHelp() {
  console.log(`
${C.bold('appspec')} — Mission HUD AppSpec command-line interface

${C.bold('Usage:')}
  appspec validate <file> [--expand]
      Validate an AppSpec against the JSON Schema. --expand qualifies
      bare component slugs via libraryRefs.components before validating.

  appspec lint <file>
      Run cross-reference integrity checks (flow→screen, asset, token,
      orphans, a11y). Reports errors + warnings.

  appspec check <file>
      Run validate + lint in one command. Exit 0 only if both pass.

  appspec migrate <file> [--out <file> | --in-place]
      Migrate a v9 AppSpec to v10. Writes to stdout by default;
      --out writes to a file; --in-place rewrites the input.

  appspec info
      Print schema id, version, installed package versions, and the
      list of valid source values for provenance.

  appspec --version | -v        Print the CLI version
  appspec --help    | -h        Show this help

${C.bold('Exit codes:')}
  0   success
  1   validation/lint/migration failure
  2   usage error (missing argument, unknown command)
`.trim());
}
