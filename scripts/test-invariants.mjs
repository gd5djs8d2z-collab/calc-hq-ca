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
 * rate to a historical year is the Alberta near-miss (AB cut 10% -> 8% from the 2025 tax year). */
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

/* ── Invariant 4: CPP / QPP contribution arithmetic ──────────────────────────────
 * Every maximum in these blocks is derived from a ceiling re-indexed each January. The
 * cases below are the realistic January failure: the YMPE moves, a derived figure doesn't.
 * Checked for BOTH plans — QPP has the same structure at a different rate (6.3% vs 5.95%),
 * so a check that only understood CPP would leave Quebec silently unguarded. */
for (const plan of ['cpp', 'qpp']) {
  check(`${plan}: real data is clean`,
    only(invariants(base, TAX_YEAR), `${plan}.`).length +
    only(invariants(base, TAX_YEAR), `${plan}:`).length, 0);

  { // the January failure: ceiling moves, derived maximum left behind
    const c = structuredClone(base);
    c[plan].ympe.value = 78000;
    check(`${plan}: YMPE moving without maxEmployeeContribution fires`,
      only(invariants(c, TAX_YEAR), `${plan}.maxEmployeeContribution`).length, 1);
  }

  { // a one-cent drift in the derived maximum
    const c = structuredClone(base);
    c[plan].maxEmployeeContribution.value += 0.01;
    check(`${plan}: a 1c drift in maxEmployeeContribution fires`,
      only(invariants(c, TAX_YEAR), `${plan}.maxEmployeeContribution`).length, 1);
  }

  { // base/enhanced split no longer summing to the headline rate
    const c = structuredClone(base);
    c[plan].enhancedCpp1Rate.value = 0.011;
    check(`${plan}: base+enhanced not summing to rate fires`,
      only(invariants(c, TAX_YEAR), `${plan}:`).length, 1);
  }

  { // second-tier maximum stale against a moved YAMPE
    const c = structuredClone(base);
    c[plan].cpp2.yampe.value = 88000;
    check(`${plan}: YAMPE moving without cpp2.maxContribution fires`,
      only(invariants(c, TAX_YEAR), `${plan}.cpp2.maxContribution`).length, 1);
  }

  { // absent block must not throw
    const c = structuredClone(base);
    delete c[plan];
    check(`${plan}: missing block does not throw`,
      only(invariants(c, TAX_YEAR), `${plan}`).length, 0);
  }
}

{ // CPP-only leaves: contributory earnings must track the ceiling less the exemption
  const c = structuredClone(base);
  c.cpp.maxContributoryEarnings.value = 71000;
  check('cpp: maxContributoryEarnings de-linked from ympe − exemption fires',
    only(invariants(c, TAX_YEAR), 'cpp.maxContributoryEarnings').length, 1);
}

{ // self-employed maximum must stay exactly double the employee side
  const c = structuredClone(base);
  c.cpp.maxSelfEmployedContribution.value = 8000;
  check('cpp: maxSelfEmployedContribution not double the employee max fires',
    only(invariants(c, TAX_YEAR), 'cpp.maxSelfEmployedContribution').length, 1);
}

{ // same for the second tier's self-employed rate and maximum
  const c = structuredClone(base);
  c.cpp.cpp2.selfEmployedRate.value = 0.07;
  check('cpp: cpp2.selfEmployedRate not double cpp2.rate fires',
    only(invariants(c, TAX_YEAR), 'cpp.cpp2.selfEmployedRate').length, 1);
}
{
  const c = structuredClone(base);
  c.cpp.cpp2.maxSelfEmployedContribution.value = 800;
  check('cpp: cpp2.maxSelfEmployedContribution not double cpp2.max fires',
    only(invariants(c, TAX_YEAR), 'cpp.cpp2.maxSelfEmployedContribution').length, 1);
}

{ // QPP lacks the optional self-employed leaves today — their absence must stay silent,
  // so adding them later is a deliberate act rather than a way to fix a failing build.
  const c = structuredClone(base);
  check('qpp: absent optional self-employed leaves stay quiet',
    only(invariants(c, TAX_YEAR), 'qpp.maxSelfEmployedContribution').length, 0);
}

/* ── Invariant 5: EI regular-benefit figures derived from the MIE ────────────────
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

/* ── Ontario Health Premium: engine copy === data copy ───────────────────────────
 * The schedule lives twice: hardcoded in tax-engine.js ontarioHealthPremium(), which the
 * calculators run, and as provinces.ON.healthPremium in the pack, which nothing reads. They
 * are deliberately NOT reconciled (that would change the array's shape and the engine); this
 * locks them together instead, at every whole dollar from $0 to $400,000. The engine function
 * is not exported, so it is read from the source text — a rename makes this throw, never skip.
 * The tier formulas are strings over `income` and `lesser` (= Math.min). */
import { readFileSync } from 'node:fs';
const enginePath = new URL('../assets/js/tax-engine.js', import.meta.url);
const engineSrc = readFileSync(enginePath, 'utf8');
const hpStart = engineSrc.indexOf('function ontarioHealthPremium(');
const hpEnd = engineSrc.indexOf('\n}\n', hpStart);
if (hpStart < 0 || hpEnd < 0) throw new Error('ontarioHealthPremium() not found in tax-engine.js — update this test');
const engineHP = new Function(`${engineSrc.slice(hpStart, hpEnd + 2)}; return ontarioHealthPremium;`)();

function dataHP(schedule, income) {
  for (const band of schedule) {
    if (income <= band.upTo) {
      return 'premium' in band ? band.premium : new Function('lesser', 'income', `return ${band.formula};`)(Math.min, income);
    }
  }
  return NaN;
}
/** Whole dollars from $0 to $400,000 where the two copies differ. */
function healthPremiumMismatches(schedule) {
  let n = 0;
  for (let income = 0; income <= 400000; income++) {
    if (Math.abs(engineHP(income) - dataHP(schedule, income)) > 1e-9) n++;
  }
  return n;
}

check('ON health premium: engine and data array agree at every dollar $0–$400,000',
  healthPremiumMismatches(base.provinces.ON.healthPremium.value), 0);

{ // a one-dollar drift in one band of the data copy must show up
  const c = structuredClone(base);
  c.provinces.ON.healthPremium.value[3].formula = 'lesser(601, 450+0.25*(income-48000))';
  check('ON health premium: a drifted data band is caught',
    healthPremiumMismatches(c.provinces.ON.healthPremium.value) > 0, true);
}

/* ── Invariant 6: a phased-out BPA starts from the BPA ───────────────────────────
 * Manitoba and Yukon stamp bpa and bpaPhaseOut.max separately; a January update to one
 * must move the other. */
check('bpaPhaseOut: real data is clean',
  invariants(base, TAX_YEAR).filter((x) => x.includes('bpaPhaseOut.max')).length, 0);

{ // Manitoba re-stamping its BPA without the phase-out must fire
  const c = structuredClone(base);
  c.provinces.MB.bpa.value = 16000;
  check('bpaPhaseOut: MB bpa moving alone fires',
    only(invariants(c, TAX_YEAR), 'provinces.MB: bpaPhaseOut.max').length, 1);
}

{ // ...and from the phase-out side, for Yukon
  const c = structuredClone(base);
  c.provinces.YT.bpaPhaseOut.value.max = 16500;
  check('bpaPhaseOut: YT max moving alone fires',
    only(invariants(c, TAX_YEAR), 'provinces.YT: bpaPhaseOut.max').length, 1);
}

/* ── Invariant 7: NB low-income reduction base = ⌈lowest rate × (threshold − BPA)⌉ ──
 * NB Income Tax Act s.49.1(2)(a). Three separate stamps feed the formula. */
check('nb-litr: real data is clean',
  only(invariants(base, TAX_YEAR), 'provinces.NB.taxReduction').length, 0);

{ // re-indexing the threshold but not the base must fire
  const c = structuredClone(base);
  c.provinces.NB.taxReduction.value.threshold += 500;
  check('nb-litr: threshold moving alone fires',
    only(invariants(c, TAX_YEAR), 'provinces.NB.taxReduction').length, 1);
}

{ // re-stamping the NB BPA but not the base must fire
  const c = structuredClone(base);
  c.provinces.NB.bpa.value += 300;
  check('nb-litr: BPA moving alone fires',
    only(invariants(c, TAX_YEAR), 'provinces.NB.taxReduction').length, 1);
}

{ // THE ROUNDING GUARD: the Act rounds UP, so the base is the ceiling, never the nearest dollar.
  // 0.094 × 8,694 = 817.24 → $818; a base of $817 (rounded to nearest) must fire.
  const c = structuredClone(base);
  c.provinces.NB.taxReduction.value.base = Math.round(0.094 * (c.provinces.NB.taxReduction.value.threshold - c.provinces.NB.bpa.value));
  check('nb-litr: a nearest-dollar base fires',
    only(invariants(c, TAX_YEAR), 'provinces.NB.taxReduction').length, 1);
}

{ // all three moved together, consistently, stays quiet
  const c = structuredClone(base);
  const t = c.provinces.NB.taxReduction.value;
  t.threshold += 400; c.provinces.NB.bpa.value += 300;
  t.base = Math.ceil(0.094 * (t.threshold - c.provinces.NB.bpa.value));
  check('nb-litr: a consistent re-index stays quiet',
    only(invariants(c, TAX_YEAR), 'provinces.NB.taxReduction').length, 0);
}

/* ── OAS recovery table row for the current income year === the scalar stamps ── */
check('oas-table: real data is clean', only(invariants(base, TAX_YEAR), 'oas.recoveryTable').length, 0);
{ const c = structuredClone(base); c.oas.recoveryTable.y2025.max65to74.value = 152000;
  check('oas-table: a table ceiling that drifts from the engine stamp fires', only(invariants(c, TAX_YEAR), 'oas.recoveryTable').length, 1); }
{ const c = structuredClone(base); c.oas.recoveryThreshold.value = 95323;
  check('oas-table: an engine threshold moved without the table fires', only(invariants(c, TAX_YEAR), 'oas.recoveryTable').length, 1); }
{ const c = structuredClone(base); c.oas.recoveryTable.y2026.max75plus.value = 161000;
  check('oas-table: a non-current row is free to differ', only(invariants(c, TAX_YEAR), 'oas.recoveryTable').length, 0); }

/* ── Payroll July 2026: the annual copies must equal the annual stamps ───────── */
check('payroll-annual: real data is clean', only(invariants(base, TAX_YEAR), 'payrollJuly2026').length, 0);
{ const c = structuredClone(base); c.provinces.BC.brackets.value[0].rate = 0.0565; c.provinces.BC.bpaCreditRate.value = 0.0565;
  check('payroll-annual: a BC annual rate moved without the payroll copy fires', only(invariants(c, TAX_YEAR), 'payrollJuly2026').length, 1); }
{ const c = structuredClone(base); c.payrollJuly2026.NL.bpaAnnual.value = 13200;
  check('payroll-annual: a payroll copy that drifts from provinces.NL.bpa fires', only(invariants(c, TAX_YEAR), 'payrollJuly2026').length, 1); }
{ const c = structuredClone(base); c.payrollJuly2026.BC.lowestRate.value = 0.0620;
  check('payroll-annual: the prorated figure itself is free to move', only(invariants(c, TAX_YEAR), 'payrollJuly2026').length, 0); }

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
