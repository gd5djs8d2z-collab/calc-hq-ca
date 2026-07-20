/**
 * check-history.mjs — CI gate for data/constant-history.json, the value-change audit trail.
 *
 * It proves the history file still tracks the live stamps. For every stamped, non-exempt leaf
 * that gen-history.mjs WOULD EMIT (i.e. its cadence has a derivable period start), it asserts:
 *   - exactly ONE history row for that key with effective_to === null (the in-force row),
 *   - that row's value deep-equals the live TAX_CONSTANTS_2026 value, and
 *   - that row's source_url matches the live stamp.
 *
 * The 49 statutory-cadence leaves have no derivable period start, so gen-history leaves them
 * out of the file; this checker skips them by the SAME rule (effectiveFrom === null) and prints
 * the count so the number stays visible.
 *
 * REUSE, DON'T REIMPLEMENT
 *   collect()/STRUCTURAL_EXEMPT and the emit rule (stampedLeaves, effectiveFrom, buildHistory)
 *   are imported from check-constants.mjs / gen-history.mjs. The key scheme is never re-derived
 *   here.
 *
 * THE "Infinity" SENTINEL
 *   Bracket ceilings are the JS number Infinity, stored in the JSON as the string "Infinity".
 *   Comparisons decode the sentinel back to Infinity BEFORE deep-equal, in both directions
 *   (decode the stored value to match live; re-encode the live value to match stored). Without
 *   this the 15 bracket-table leaves would mismatch forever. A built-in self-test (below) locks
 *   that behaviour down: it confirms a real bracket leaf passes, then corrupts the sentinel to
 *   null and confirms the SAME comparison then FAILS.
 *
 * USAGE
 *   node scripts/check-history.mjs
 * Exits 1 on any failed assertion or a failed self-test. Touches no source or calculator file.
 */
import { readFileSync } from 'node:fs';
import { TAX_CONSTANTS_2026 } from '../data/tax-constants-2026.js';
import { collect } from './check-constants.mjs';
import {
  stampedLeaves, effectiveFrom, decodeInfinity, encodeInfinity, INFINITY_SENTINEL,
} from './gen-history.mjs';

const HISTORY_PATH = new URL('../data/constant-history.json', import.meta.url);

/** Structural deep-equality. Treats Infinity === Infinity (both sides are decoded first, so
 *  no NaN games), is order-sensitive for arrays, and order-insensitive for object keys. */
function deepEqual(a, b) {
  if (a === b) return true;                          // primitives incl. Infinity === Infinity
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/** Compare a live constant value against a stored history value. Decodes the "Infinity"
 *  sentinel in BOTH directions so bracket ceilings compare as the number Infinity. */
function valuesMatch(liveValue, storedValue) {
  return deepEqual(liveValue, decodeInfinity(storedValue))          // stored -> number, vs live
      && deepEqual(encodeInfinity(liveValue), storedValue);         // live  -> sentinel, vs stored
}

/**
 * Self-test for the sentinel path (the CRITICAL requirement). Picks a real bracket leaf, proves
 * it PASSES through valuesMatch, then corrupts its "Infinity" sentinel to null and proves the
 * SAME comparison FAILS. Returns [] on success, or failure strings.
 */
function sentinelSelfTest(records, history) {
  const errs = [];
  const bracketRec = stampedLeaves(records).find(
    (r) => r.path.endsWith('.brackets') && effectiveFrom(r) &&
           encodeInfinity(r.value) !== r.value &&                    // actually contains Infinity
           JSON.stringify(encodeInfinity(r.value)).includes(`"${INFINITY_SENTINEL}"`));
  if (!bracketRec) { errs.push('self-test: no Infinity-bearing bracket leaf found to test'); return errs; }

  const row = history.find((h) => h.key === bracketRec.path && h.effective_to === null);
  if (!row) { errs.push(`self-test: no in-force history row for ${bracketRec.path}`); return errs; }

  // 1) the real bracket leaf must PASS
  if (!valuesMatch(bracketRec.value, row.value)) {
    errs.push(`self-test: ${bracketRec.path} should match its history row but did not — ` +
      'the sentinel decode is broken');
  }
  // 2) corrupt the sentinel ("Infinity" -> null) and confirm the comparison now FAILS
  const corrupted = JSON.parse(
    JSON.stringify(row.value).replaceAll(`"${INFINITY_SENTINEL}"`, 'null'));
  if (valuesMatch(bracketRec.value, corrupted)) {
    errs.push(`self-test: ${bracketRec.path} matched even with the Infinity sentinel corrupted ` +
      'to null — the checker would never catch a broken ceiling');
  }
  return { errs, leaf: bracketRec.path };
}

function main() {
  const records = collect();
  const history = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));

  // Index in-force rows (effective_to === null) by key; flag duplicates as we go.
  const inForceByKey = new Map();
  const dupKeys = new Set();
  for (const row of history) {
    if (row.effective_to !== null) continue;
    if (inForceByKey.has(row.key)) dupKeys.add(row.key);
    else inForceByKey.set(row.key, row);
  }

  const failures = [];
  let checked = 0, skipped = 0;

  for (const rec of stampedLeaves(records)) {
    if (!effectiveFrom(rec)) { skipped++; continue; }    // statutory — out of scope, same rule as gen
    checked++;
    const key = rec.path;

    const inForce = history.filter((h) => h.key === key && h.effective_to === null);
    if (inForce.length === 0) { failures.push(`${key}: no history row with effective_to=null`); continue; }
    if (inForce.length > 1)  { failures.push(`${key}: ${inForce.length} rows with effective_to=null (want exactly 1)`); continue; }

    const row = inForce[0];
    if (!valuesMatch(rec.value, row.value)) {
      failures.push(`${key}: history value does not deep-equal the live value`);
    }
    if (row.source_url !== rec.source_url) {
      failures.push(`${key}: source_url "${row.source_url}" != live "${rec.source_url}"`);
    }
  }

  // Self-test the sentinel path.
  const selfTest = sentinelSelfTest(records, history);
  const selfErrs = selfTest.errs ?? selfTest;   // sentinelSelfTest returns {errs,leaf} or [errs]
  const selfLeaf = selfTest.leaf ?? '(none)';

  // ---- report, in the existing checker's style ----
  const lines = [];
  lines.push('constant-history back-reference check — every in-force row tracks a live stamp');
  lines.push(`${checked} emitted leaves checked, ${skipped} statutory skipped (out of scope), ` +
    `${history.length} history rows total`);
  lines.push(`sentinel self-test on ${selfLeaf}: ${selfErrs.length ? 'FAIL' : 'ok'} ` +
    '(bracket leaf passes; corrupting "Infinity"→null makes it fail)');
  lines.push('');

  const allFailures = [...failures, ...selfErrs];
  if (allFailures.length) {
    lines.push(`${allFailures.length} ISSUE(S):`);
    for (const f of allFailures) lines.push(`  ${f}`);
  } else {
    lines.push(`PASS — all ${checked} emitted leaves have exactly one in-force row whose value ` +
      'and source_url match the live stamp.');
  }
  console.log(lines.join('\n'));
  return allFailures.length ? 1 : 0;
}

const code = main();
process.exitCode = code;
