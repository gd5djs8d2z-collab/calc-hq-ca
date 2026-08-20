/**
 * check-schema.mjs — CI gate for figures duplicated into JSON-LD.
 *
 * THE DRIFT SURFACE
 *   Every visible figure on a calculator page is restated as a literal in the page's
 *   application/ld+json block. It has to be: crawlers read JSON-LD as raw text, so it
 *   cannot be filled from data/tax-constants-2026.js at runtime the way a rendered page
 *   could. That leaves the schema needing a manual touch each January the visible page
 *   does not, and check-constants.mjs structurally cannot see it — those numbers live in
 *   HTML, not in the pack.
 *
 *   This is the mechanism that rotted the eicalc.ca satellite: a $79,000 EI repayment
 *   threshold, correct for 2024 (1.25 x the $63,200 MIE), carried unnoticed for two years
 *   because nothing tied it back to the MIE it derives from.
 *
 * WHAT IT ASSERTS
 *   1. VALID   — every application/ld+json block parses as JSON. (Nothing else checks this;
 *                a malformed block is silently dropped by every consumer, so it fails open.)
 *   2. RETIRED — no money/percent token inside a JSON-LD block matches a value that the pack
 *                USED to hold and no longer does.
 *
 * WHY "RETIRED", NOT "NOT IN THE PACK"
 *   A naive "every figure in the schema must be a current pack value" rule drowns in false
 *   positives: worked examples ($900, $495, $9,900), statutory rates (55%, 30%, 90%) and
 *   plain counts are all legitimately literal and will never be pack values. Matching
 *   against RETIRED values instead is near-zero-false-positive by construction — a figure is
 *   only flagged when the pack itself is on record as having moved off it.
 *
 *   Per-block annotation was the other option and is rejected on purpose: it is opt-in, so a
 *   page added later is silently uncovered, which is the failure mode this gate exists for.
 *
 * COVERAGE DEPENDS ON data/constant-history.json HAVING SUPERSEDED ROWS.
 *   Until a tracked value actually changes there is nothing to match against, and this gate
 *   passes because it has no ammunition rather than because the pages are correct. That
 *   state is REPORTED LOUDLY rather than shown as a clean pass — a gate that quietly no-ops
 *   is worse than no gate. gen-history.mjs preserves superseded rows (see mergeHistory), so
 *   the set fills in from the first January a value moves.
 *
 * MATCHING RULES
 *   Tokens are canonicalised, not string-matched, so $68,900 / $68,900.00 / 68900 all
 *   compare equal. A money token matches a pack number directly. A percent token matches a
 *   pack number only when that number is a decimal fraction (0 < p < 1), because this pack
 *   stores rates that way (0.0163 -> 1.63%); whole numbers are never read as percentages, so
 *   generalDropoutMaxYears: 8 can never collide with an "8%" in the copy.
 *   A retired value that is ALSO a current value never fires (values recur; shared figures
 *   like a frozen $3,500 exemption must not be flagged just because some other key moved).
 *
 * USAGE
 *   node scripts/check-schema.mjs [--verbose]
 * Exits 1 on any invalid block or retired figure. Reads HTML + constant-history.json only.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler', 'scripts', 'assets']);
const LD_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
/**
 * $1,234.56 | $729 | 1.63% | 55%
 *
 * Each alternative must END ON A DIGIT before its optional decimals — `[\d,]*\d` rather than
 * `[\d,]*` — because a greedy comma class swallows the comma in "$79,000, you repay" and
 * reports the token as "$79,000,". It canonicalises the same either way, but the failure
 * message is what a maintainer greps for, so it has to be the literal that is in the file.
 *
 * DELIBERATE LIMITATION: a bare integer ("79000", "700") is NOT a token. Only $-prefixed and
 * %-suffixed figures are scanned. Bare integers are overwhelmingly counts in this copy — 41
 * rows, 12 columns, 14-45 weeks, 420-700 hours — and a retired small value such as
 * generalDropoutMaxYears: 8 would otherwise match incidental numbers all over the schema.
 * The cost is that a retired figure written without a currency symbol is missed; the benefit
 * is that this rule stays near-zero-false-positive, which is what makes it safe to gate CI.
 */
const FIGURE_RE = /\$\s?\d(?:[\d,]*\d)?(?:\.\d+)?|\d(?:[\d,]*\d)?(?:\.\d+)?\s?%/g;

/** Every .html file in the repo, repo-relative. */
export function htmlFiles(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) htmlFiles(full, out);
    else if (name.endsWith('.html')) out.push(relative(ROOT, full));
  }
  return out;
}

/** Canonical key for a figure: "money:68900" or "pct:1.63". */
const moneyKey = (n) => `money:${n}`;
const pctKey = (n) => `pct:${Math.round(n * 100) / 100}`;

/** Parse one figure token into its canonical key, or null if unparseable. */
export function canonicalise(raw) {
  const isPct = raw.includes('%');
  const n = Number(raw.replace(/[$%,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return isPct ? pctKey(n) : moneyKey(n);
}

/** All figure tokens in a string, with their offsets. */
export function figureTokens(text) {
  const out = [];
  for (const m of text.matchAll(FIGURE_RE)) {
    const key = canonicalise(m[0]);
    if (key) out.push({ raw: m[0].trim(), key, index: m.index });
  }
  return out;
}

/** Every number nested anywhere inside a stored history value. */
export function numbersIn(value, out = []) {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

/** The canonical keys a single pack number can legitimately appear as. */
export function keysForNumber(n) {
  const keys = [moneyKey(n)];
  if (n > 0 && n < 1) keys.push(pctKey(n * 100));   // decimal fractions are rates
  return keys;
}

/**
 * Split history rows into the set of currently-valid figures and the map of retired ones.
 * A figure retired by one key but still current under another is NOT retired.
 */
export function valueSets(history) {
  const current = new Set();
  const retired = new Map();                        // canonical key -> { keys:Set, values:Set }
  for (const row of history) {
    const target = row.effective_to === null ? 'current' : 'retired';
    for (const n of numbersIn(row.value)) {
      for (const k of keysForNumber(n)) {
        if (target === 'current') current.add(k);
        else {
          if (!retired.has(k)) retired.set(k, { keys: new Set(), values: new Set() });
          retired.get(k).keys.add(row.key);
          retired.get(k).values.add(n);
        }
      }
    }
  }
  for (const k of current) retired.delete(k);       // recurring / shared values are not stale
  return { current, retired };
}

/** The current value(s) of a pack key, for the "should now be" half of a failure message. */
function currentValuesOf(history, key) {
  return history
    .filter((r) => r.key === key && r.effective_to === null)
    .flatMap((r) => numbersIn(r.value));
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Core check. `files` is [{path, html}] so tests can supply synthetic input. */
export function check({ files, history }) {
  const { current, retired } = valueSets(history);
  const failures = [];
  let blocks = 0, tokens = 0;

  for (const { path, html } of files) {
    for (const m of html.matchAll(LD_RE)) {
      blocks++;
      const body = m[1];
      const line = lineOf(html, m.index);
      try {
        JSON.parse(body);
      } catch (err) {
        failures.push(`INVALID  ${path}:${line}: application/ld+json does not parse — ${err.message}`);
        continue;                                   // cannot trust tokens from a broken block
      }
      for (const tok of figureTokens(body)) {
        tokens++;
        const hit = retired.get(tok.key);
        if (!hit) continue;
        const owners = [...hit.keys];
        const now = owners.flatMap((k) => currentValuesOf(history, k));
        failures.push(
          `RETIRED  ${path}:${line + lineOf(body, tok.index) - 1}: ${tok.raw} is a retired value of ` +
          `${owners.join(', ')}${now.length ? ` (now ${[...new Set(now)].join(', ')})` : ''}`);
      }
    }
  }
  return { failures, stats: { files: files.length, blocks, tokens, retired: retired.size, current: current.size } };
}

export function report({ verbose = false } = {}) {
  const history = JSON.parse(readFileSync(join(ROOT, 'data/constant-history.json'), 'utf8'));
  const files = htmlFiles().map((path) => ({ path, html: readFileSync(join(ROOT, path), 'utf8') }));
  const { failures, stats } = check({ files, history });

  const lines = [
    'JSON-LD figure check — page schema against retired pack values',
    `${stats.blocks} ld+json blocks in ${stats.files} HTML files, ${stats.tokens} figure tokens scanned`,
    `${stats.current} current figures, ${stats.retired} retired figures known from constant-history.json`,
    '',
  ];
  if (stats.retired === 0) {
    lines.push('NOTE — no superseded rows in constant-history.json yet, so the RETIRED rule has');
    lines.push('       nothing to match against. This run proves JSON-LD validity only. The rule');
    lines.push('       arms itself the first time a tracked value changes; gen-history.mjs keeps');
    lines.push('       superseded rows so that history accumulates rather than being overwritten.');
    lines.push('');
  }
  if (failures.length) {
    lines.push(`${failures.length} ISSUE(S):`, ...failures.map((f) => `  ${f}`));
  } else {
    lines.push('PASS — every ld+json block parses, and no figure in one matches a retired pack value.');
  }
  if (verbose) {
    lines.push('', 'retired figures being watched for:');
    for (const [k, v] of valueSets(history).retired) lines.push(`  ${k}  (was ${[...v.keys].join(', ')})`);
  }
  console.log(lines.join('\n'));
  return failures.length ? 1 : 0;
}

if (process.argv?.[1]?.endsWith('check-schema.mjs')) {
  process.exitCode = report({ verbose: process.argv.includes('--verbose') });
}
