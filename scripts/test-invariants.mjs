/**
 * test-invariants.mjs — NEGATIVE tests for the cross-field invariants in check-constants.mjs.
 *
 * WHY THIS FILE EXISTS
 *   A gate that ships in the same commit as the data it validates is self-approving: it passes,
 *   but nothing proves it would ever FAIL. These tests corrupt a clone of the real constants and
 *   assert each invariant actually fires — and, just as important, that it stays QUIET in the
 *   cases where firing would be a false alarm.
 *
 *   Every test operates on a structuredClone of TAX_CONSTANTS_2026. Nothing here writes a file.
 *
 * USAGE
 *   node scripts/test-invariants.mjs
 * Exits 1 if any invariant fails to fire when it should, or fires when it should not.
 */
import { TAX_CONSTANTS_2026, TAX_YEAR } from '../data/tax-constants-2026.js';
import { invariants } from './check-constants.mjs';

const results = [];
function check(name, actual, expected) {
  const ok = actual === expected;
  results.push({ name, ok, actual, expected });
  return ok;
}

/** Violations whose message starts with `prefix` — so each invariant is tested in isolation. */
const only = (list, prefix) => list.filter((x) => x.startsWith(prefix));

const base = structuredClone(TAX_CONSTANTS_2026);

/* ── Invariant 1: cdb.years.y<current>.threshold === ccb.threshold2 ──────────────
 * The two figures have coincided in every published benefit year but are published
 * separately by CRA, so the CDB block stamps its own. This catches a divergence. */
check('cdb: real data is clean',
  only(invariants(base, TAX_YEAR), 'cdb.').length, 0);

{ // a $1 divergence must fire
  const c = structuredClone(base);
  c.cdb.years.y2026.value.threshold += 1;
  check('cdb: threshold diverging from ccb.threshold2 fires',
    only(invariants(c, TAX_YEAR), 'cdb.').length, 1);
}

{ // divergence introduced from the CCB side must fire too
  const c = structuredClone(base);
  c.ccb.threshold2.value = 80000;
  check('cdb: ccb.threshold2 moving alone fires',
    only(invariants(c, TAX_YEAR), 'cdb.').length, 1);
}

{ // THE FALSE-ALARM GUARD. In the July window one block may be updated before the other.
  // Comparing a CDB threshold for one benefit year against a CCB threshold for another is the
  // year/value mix-up MAINTENANCE.md records as the Alberta near-miss — it must be SKIPPED.
  const c = structuredClone(base);
  c.ccb.benefitYear.value = 'July 2027 – June 2028';
  c.ccb.threshold2.value = 84500;
  check('cdb: mismatched benefit years are skipped, not compared',
    only(invariants(c, TAX_YEAR), 'cdb.').length, 0);
}

{ // absent block must not throw
  const c = structuredClone(base);
  delete c.cdb;
  check('cdb: missing block does not throw',
    only(invariants(c, TAX_YEAR), 'cdb.').length, 0);
}

/* ── Invariant 2: dtc.provincial.<code>.y<TAX_YEAR>.rate === provinces.<code>.brackets[0].rate ──
 * The DTC is valued at each jurisdiction's lowest rate FOR THAT TAX YEAR. Applying a current
 * rate to a historical year is the Alberta near-miss (AB cut 10% -> 8% for 2026 only). */
check('dtc: real data is clean',
  only(invariants(base, TAX_YEAR), 'dtc.').length, 0);

{ // simulate next January: add y2026 rows copying each live bracket rate — must stay clean
  const c = structuredClone(base);
  for (const [code, years] of Object.entries(c.dtc.provincial)) {
    years[`y${TAX_YEAR}`] = {
      value: { amount: 9999, rate: c.provinces[code].brackets.value[0].rate },
      source_url: 'test', last_verified: '2026-07-25',
    };
  }
  check('dtc: correct current-year rows stay clean',
    only(invariants(c, TAX_YEAR), 'dtc.').length, 0);

  // now inject the near-miss: a HISTORICAL Alberta rate on the current-year row
  c.dtc.provincial.AB[`y${TAX_YEAR}`].value.rate = 0.10;
  check('dtc: historical rate on a current-year row fires',
    only(invariants(c, TAX_YEAR), 'dtc.').length, 1);
}

/* ── report ─────────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
const lines = ['cross-field invariant negative tests', ''];
for (const r of results) {
  lines.push(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}` +
    (r.ok ? '' : `  (got ${r.actual} violation(s), expected ${r.expected})`));
}
lines.push('');
lines.push(failed.length
  ? `${failed.length} of ${results.length} FAILED — an invariant is not doing its job.`
  : `PASS — all ${results.length} cases: every invariant fires on corrupt input and stays quiet on valid input.`);
console.log(lines.join('\n'));
process.exitCode = failed.length ? 1 : 0;
