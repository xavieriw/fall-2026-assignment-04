#!/usr/bin/env node
/**
 * render_erd.js — validate a Mermaid ERD and compile it to SVG.
 *
 * Usage:
 *   node .agent/skills/erd-generator/scripts/render_erd.js [input.mmd] [output.svg]
 *
 * Defaults:
 *   input  = docs/architecture/schema.mmd
 *   output = docs/architecture/erd.svg
 *
 * On success: writes the SVG, prints `SUCCESS`, exits 0.
 * On failure: prints `SYNTAX_ERROR:` followed by the mmdc stderr trace, exits 1.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_INPUT = 'docs/architecture/schema.mmd';
const DEFAULT_OUTPUT = 'docs/architecture/erd.svg';

function fail(message) {
  console.log(`SYNTAX_ERROR: ${message.trim()}`);
  process.exit(1);
}

const input = path.resolve(process.argv[2] ?? DEFAULT_INPUT);
const output = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT);

if (!existsSync(input)) {
  fail(`Input file not found: ${input}`);
}

const source = readFileSync(input, 'utf8');
if (!/^\s*(%%.*\n\s*)*erDiagram\b/m.test(source)) {
  fail(`${input} must be a Mermaid entity-relationship diagram starting with "erDiagram".`);
}

mkdirSync(path.dirname(output), { recursive: true });
// Remove any stale SVG so a failed compile can never leave an old asset behind.
rmSync(output, { force: true });

// Invoke the locally installed mermaid-cli (`npx mmdc`). `shell: true` lets
// npx resolve on Windows (npx.cmd) as well as POSIX shells.
const quote = (p) => `"${p}"`;
const result = spawnSync(
  `npx --no-install mmdc -i ${quote(input)} -o ${quote(output)} --quiet`,
  { encoding: 'utf8', shell: true }
);

const stderr = (result.stderr ?? '').trim();
const stdout = (result.stdout ?? '').trim();

if (result.error) {
  fail(`Unable to launch mmdc: ${result.error.message}`);
}

if (result.status !== 0) {
  fail(stderr || stdout || `mmdc exited with code ${result.status}`);
}

// Guard against mmdc producing an empty file or Mermaid's "Syntax error" placeholder SVG.
if (!existsSync(output) || statSync(output).size === 0) {
  fail(stderr || 'mmdc reported success but no SVG was produced.');
}
const svg = readFileSync(output, 'utf8');
if (/Syntax error in (text|graph)/i.test(svg)) {
  rmSync(output, { force: true });
  fail(stderr || 'Mermaid rendered a syntax-error diagram.');
}

console.log('SUCCESS');
process.exit(0);
