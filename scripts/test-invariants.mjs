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

/* ── Invariant 3: the three RDSP threshold linkages ──────────────────────────
 * Each RDSP threshold equals a figure stamped elsewhere, by legislated linkage. They are
 * three SEPARATE checks so a failure names which linkage broke — so each is corrupted
 * individually here, and each must produce exactly one violation naming its own key. */
check('rdsp: real data is clean',
  only(invariants(base, TAX_YEAR), 'rdsp.').length, 0);

for (const [key, partner] of [
  ['grantThreshold', 'federal.brackets[1].max'],
  ['bondZeroThreshold', 'federal.brackets[0].max'],
  ['bondFullThreshold', 'ccb.threshold1'],
]) {
  const c = structuredClone(base);
  c.rdsp[key].value += 1;
  const v = only(invariants(c, TAX_YEAR), 'rdsp.');
  check(`rdsp: ${key} de-linking fires exactly one violation`, v.length, 1);
  // and it must be the RIGHT one — a single lumped check would pass the count test above
  // while pointing at the wrong linkage, which is the whole reason these are separate.
  check(`rdsp: ${key} violation names ${partner}`,
    v.length === 1 && v[0].includes(`rdsp.${key}`) && v[0].includes(partner), true);
}

{ // corrupting the PARTNER side must fire too, and name the same pair
  const c = structuredClone(base);
  c.federal.brackets.value[0].max += 1;
  const v = only(invariants(c, TAX_YEAR), 'rdsp.');
  check('rdsp: partner-side change (federal bracket 0) fires', v.length, 1);
  check('rdsp: partner-side violation names bondZeroThreshold',
    v.length === 1 && v[0].includes('bondZeroThreshold'), true);
}

{ // all three at once -> three distinct violations, not one merged message
  const c = structuredClone(base);
  c.rdsp.grantThreshold.value += 1;
  c.rdsp.bondZeroThreshold.value += 1;
  c.rdsp.bondFullThreshold.value += 1;
  check('rdsp: three simultaneous de-linkings report three violations',
    only(invariants(c, TAX_YEAR), 'rdsp.').length, 3);
}

{ // absent block must not throw
  const c = structuredClone(base);
  delete c.rdsp;
  check('rdsp: missing block does not throw',
    only(invariants(c, TAX_YEAR), 'rdsp.').length, 0);
}

/* ── Invariant 4: EI regular-benefit figures derived from the MIE ────────────────
 * repaymentThreshold = 1.25 × MIE and maxWeeklyBenefit = round(MIE × 55% / 52). Both are
 * plausible-looking numbers that go stale silently when the MIE is re-indexed each January.
 * The first test below reproduces the ACTUAL defect found on eicalc.ca in August 2026: a
 * $79,000 repayment threshold, correct for 2024, carried forward two years unnoticed. */
check('ei: real data is clean',
  only(invariants(base, TAX_YEAR), 'ei.').length, 0);

{ // the real-world stale value: 2024's threshold (1.25 × $63,200) against a 2026 MIE
  const c = structuredClone(base);
  c.ei.repaymentThreshold.value = 79000;
  check('ei: the eicalc.ca $79,000 stale clawback threshold fires',
    only(invariants(c, TAX_YEAR), 'ei.repaymentThreshold').length, 1);
}

{ // a January MIE bump with the derived threshold left behind must fire
  const c = structuredClone(base);
  c.ei.maxInsurableEarnings.value = 71000;
  check('ei: MIE moving without repaymentThreshold fires',
    only(invariants(c, TAX_YEAR), 'ei.repaymentThreshold').length, 1);
}

{ // a $1 drift in the weekly cap must fire
  const c = structuredClone(base);
  c.ei.maxWeeklyBenefit.value += 1;
  check('ei: maxWeeklyBenefit drifting from the MIE fires',
    only(invariants(c, TAX_YEAR), 'ei.maxWeeklyBenefit').length, 1);
}

{ // floor instead of round would give 694 for 2025's MIE — assert round is what's enforced
  const c = structuredClone(base);
  c.ei.maxInsurableEarnings.value = 65700;      // 2025 MIE
  c.ei.repaymentThreshold.value = 65700 * 1.25; // keep the other invariant quiet
  c.ei.maxWeeklyBenefit.value = 695;            // Service Canada's published 2025 figure
  check('ei: published 2025 weekly max ($695) reconciles by round, not floor',
    only(invariants(c, TAX_YEAR), 'ei.maxWeeklyBenefit').length, 0);
}

{ // a dropped row in the 41-row duration matrix must fire
  const c = structuredClone(base);
  c.ei.benefitWeeksTable.value.splice(10, 1);
  check('ei: a dropped duration-matrix row fires',
    only(invariants(c, TAX_YEAR), 'ei.benefitWeeksTable').length, 1);
}

{ // a short (ragged) row must fire
  const c = structuredClone(base);
  c.ei.benefitWeeksTable.value[5].pop();
  check('ei: a short duration-matrix row fires',
    only(invariants(c, TAX_YEAR), 'ei.benefitWeeksTable').length, 1);
}

{ // a week count above the 45-week statutory ceiling must fire
  const c = structuredClone(base);
  c.ei.benefitWeeksTable.value[0][13] = 46;
  check('ei: a duration above benefitWeeksMax fires',
    only(invariants(c, TAX_YEAR), 'ei.benefitWeeksTable').length, 1);
}

{ // hoursBands and bestWeeks drifting apart must fire
  const c = structuredClone(base);
  c.ei.hoursBands.value[3][0] = 9.5;
  check('ei: hoursBands and bestWeeks describing different bands fires',
    only(invariants(c, TAX_YEAR), 'ei.hoursBands').length, 1);
}

{ // absent block must not throw
  const c = structuredClone(base);
  delete c.ei;
  check('ei: missing block does not throw',
    only(invariants(c, TAX_YEAR), 'ei.').length, 0);
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
