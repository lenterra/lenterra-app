#!/usr/bin/env node
// Download-size budget for the Android build (TRD-PERF-003).
//
// 40 MB, and the number is not arbitrary. The target student buys data by the
// megabyte on a prepaid plan, so a 60 MB download is not "a bit slower" — it is
// a decision not to install, made by somebody weighing it against phone credit.
// The demo shipped a universal debug APK; halving a download matters when
// somebody is paying for each half.
//
// The budget fails the build rather than reporting after a regression is
// noticed (TRD-PERF-009), and prints both numbers so the failure says how far
// over rather than merely that it is over.
//
// Usage: node scripts/size-budget.mjs <path-to-apk-or-directory>

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/** Per-architecture download ceiling. */
const BUDGET_BYTES = 40 * 1024 * 1024;

/**
 * Ceiling for a universal APK, which is not what ships.
 *
 * The download budget requires per-architecture splits. A universal build
 * carries every ABI's native libraries — for a project with crypto and wallet
 * dependencies that is most of the download — so it is measured against a
 * separate, larger number and reported as the wrong artefact rather than
 * silently passed.
 */
const UNIVERSAL_BUDGET_BYTES = 90 * 1024 * 1024;

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/size-budget.mjs <path-to-apk-or-directory>');
  process.exit(2);
}

if (!existsSync(target)) {
  console.error(`no build found at ${target}`);
  process.exit(2);
}

function apksIn(path) {
  if (statSync(path).isFile()) return [path];
  const out = [];
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) out.push(...apksIn(full));
    else if (extname(entry) === '.apk' || extname(entry) === '.aab') out.push(full);
  }
  return out;
}

const builds = apksIn(target);
if (builds.length === 0) {
  console.error(`no .apk or .aab under ${target}`);
  process.exit(2);
}

/** A universal APK has no ABI in its filename; a split build names one. */
const ABIS = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];
const isSplit = (name) => ABIS.some((abi) => name.includes(abi));

let failed = false;
let sawSplit = false;

for (const build of builds) {
  const name = basename(build);
  const bytes = statSync(build).size;
  const split = isSplit(name);
  if (split) sawSplit = true;

  const budget = split ? BUDGET_BYTES : UNIVERSAL_BUDGET_BYTES;
  const over = bytes > budget;
  if (over) failed = true;

  console.log(
    `${over ? '✖' : '✓'} ${name.padEnd(46)} ${mb(bytes).padStart(9)} / ${mb(budget)}` +
      (split ? '' : '  (universal)'),
  );
}

if (!sawSplit) {
  // Not a failure on its own — a local one-off build is legitimately universal
  // — but it means the number above is not the number a student downloads.
  console.warn(
    '\n! no per-architecture build found. The download budget requires splits;\n' +
      '  a universal APK makes every student download every architecture.',
  );
}

if (failed) {
  console.error('\nover budget. Raising it requires a reviewed change to 20-15.');
  process.exit(1);
}

console.log('\nwithin budget.');
