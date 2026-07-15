/**
 * rates-2026.js — runtime tax/payroll constants + benefit-program data for calc-hq.ca.
 *
 * The income-tax and payroll constants (FEDERAL, CPP, EI, PROVINCES) are DERIVED from the
 * provenance-tracked SOURCE OF TRUTH in ./tax-constants-2026.js — this file just unwraps
 * each { value, source_url, last_verified } node into the plain numbers the tax engine and
 * every calculator consume. To change a tax number, edit tax-constants-2026.js, not here.
 *
 * The benefit-program objects lower down (ONTARIO_ESA, CCB, LTT, CPP_RETIREMENT,
 * EI_PARENTAL) still hold their constants inline — they are NOT yet migrated to the
 * provenance file (a follow-up). Each carries its own source + verified-date comments.
 */
import { TAX_CONSTANTS_2026 as TC, TAX_YEAR } from './tax-constants-2026.js';
export { TAX_YEAR };

// Unwrap a provenance node { value, source_url, last_verified } → its value.
const v = (node) => node.value;

/* ── FEDERAL ─────────────────────────────────────────────────────────────── */
export const FEDERAL = {
  brackets: v(TC.federal.brackets),
  bpa: v(TC.federal.bpa),
  canadaEmploymentAmountMaxCredit: v(TC.federal.canadaEmploymentAmountMaxCredit),
  canadaEmploymentAmountBase: v(TC.federal.canadaEmploymentAmountBase),
};

/* ── CPP / CPP2 ──────────────────────────────────────────────────────────── */
export const CPP = {
  rate: v(TC.cpp.rate),
  basicExemption: v(TC.cpp.basicExemption),
  ympe: v(TC.cpp.ympe),
  maxEmployeeContribution: v(TC.cpp.maxEmployeeContribution),
  cpp2: {
    rate: v(TC.cpp.cpp2.rate),
    yampe: v(TC.cpp.cpp2.yampe),
    maxContribution: v(TC.cpp.cpp2.maxContribution),
  },
  selfEmployedMultiplier: TC.cpp.selfEmployedMultiplier,
  enhancedCpp1Rate: v(TC.cpp.enhancedCpp1Rate),
  baseCpp1Rate: v(TC.cpp.baseCpp1Rate),
};

/* ── QPP (Québec Pension Plan) — replaces CPP for Quebec ──────────────────── */
// Same field shape as CPP so the engine's calcCPP() can take either plan object.
export const QPP = {
  rate: v(TC.qpp.rate),
  basicExemption: v(TC.qpp.basicExemption),
  ympe: v(TC.qpp.ympe),
  maxEmployeeContribution: v(TC.qpp.maxEmployeeContribution),
  cpp2: {
    rate: v(TC.qpp.cpp2.rate),
    yampe: v(TC.qpp.cpp2.yampe),
    maxContribution: v(TC.qpp.cpp2.maxContribution),
  },
  selfEmployedMultiplier: TC.qpp.selfEmployedMultiplier,
  enhancedCpp1Rate: v(TC.qpp.enhancedCpp1Rate),
  baseCpp1Rate: v(TC.qpp.baseCpp1Rate),
};

/* ── EI ──────────────────────────────────────────────────────────────────── */
export const EI = {
  rate: v(TC.ei.rate),
  maxInsurableEarnings: v(TC.ei.maxInsurableEarnings),
  maxEmployeePremium: v(TC.ei.maxEmployeePremium),
  employerRate: v(TC.ei.employerRate),
  maxEmployerPremium: v(TC.ei.maxEmployerPremium),
  benefitReplacementRate: v(TC.ei.benefitReplacementRate),
  quebec: {
    rate: v(TC.ei.quebec.rate),
    maxEmployeePremium: v(TC.ei.quebec.maxEmployeePremium),
  },
};

/* ── QPIP (Québec Parental Insurance Plan) — contribution side ────────────── */
// Quebec workers pay this on top of the reduced federal EI rate (EI.quebec).
export const QPIP = {
  employeeRate: v(TC.qpip.employeeRate),
  employerRate: v(TC.qpip.employerRate),
  selfEmployedRate: v(TC.qpip.selfEmployedRate),
  maxInsurableEarnings: v(TC.qpip.maxInsurableEarnings),
  maxEmployeePremium: v(TC.qpip.maxEmployeePremium),
  maxEmployerPremium: v(TC.qpip.maxEmployerPremium),
  maxSelfEmployedPremium: v(TC.qpip.maxSelfEmployedPremium),
};

/* ── PROVINCES & TERRITORIES ─────────────────────────────────────────────── */
// Derived from TC.provinces, reconstructing the exact shape the engine reads. Optional
// fields (surtax, healthPremium, taxReduction, bpaPhaseOut, includesCanadaEmploymentAmount)
// are attached only where a jurisdiction defines them.
function buildProvince(p) {
  const out = {
    name: p.name,
    indexation: p.indexation,
    brackets: v(p.brackets),
    bpa: v(p.bpa),
    bpaCreditRate: p.bpaCreditRate,
    surtax: p.surtax ? v(p.surtax) : [],
    healthPremium: p.healthPremium ? v(p.healthPremium) : [],
  };
  if (p.healthPremiumMax !== undefined) out.healthPremiumMax = p.healthPremiumMax;
  if (p.taxReduction) out.taxReduction = v(p.taxReduction);
  if (p.bpaPhaseOut) out.bpaPhaseOut = v(p.bpaPhaseOut);
  if (p.includesCanadaEmploymentAmount) out.includesCanadaEmploymentAmount = true;
  return out;
}

export const PROVINCES = Object.fromEntries(
  Object.entries(TC.provinces).map(([code, p]) => [code, buildProvince(p)])
);

/* QUEBEC — STUB. Not in the constants file yet; added tomorrow as the inaugural run of
   this maintenance system (QPP / QPIP / 16.5% abatement). Kept here so PROVINCE_ORDER and
   any lookup resolve, but the calculators must NOT compute for it. */
PROVINCES.QC = {
  name: 'Quebec',
  _status: 'DEFERRED — build separately.',
  _why: [
    'Quebec uses QPP (not CPP) at a higher rate — separate contribution math.',
    'Quebec has QPIP (parental insurance) on top of a reduced EI rate.',
    'Quebec residents receive a 16.5% federal abatement — federal tax is reduced.',
    'Quebec has its own brackets/BPA. CRA PDOC itself excludes Quebec.',
  ],
};

/* ── SHIP GATE ───────────────────────────────────────────────────────────── */
// Which jurisdictions the calculators are allowed to compute for in THIS build.
// Everywhere except Quebec is live. QC remains reference-only ("coming soon") —
// QPP/QPIP/abatement not yet modelled.
export const PROVINCE_STATUS = {
  ON: 'live', AB: 'live', BC: 'live', SK: 'live', MB: 'live', NS: 'live',
  NB: 'live', NL: 'live', PE: 'live', YT: 'live', NT: 'live', NU: 'live', QC: 'stub',
};
export const LIVE_PROVINCES = ['ON', 'AB', 'BC', 'SK', 'MB', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'];
export const PROVINCE_ORDER = ['ON', 'AB', 'BC', 'SK', 'MB', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU', 'QC'];

/* ── ONTARIO EMPLOYMENT STANDARDS ACT — statutory termination notice ──────── */
// [ESA] Ontario ESA s.57 — minimum notice / pay in lieu on termination. Statutory
// only; this is NOT common-law reasonable notice. Verified 2026-07-12 against:
// https://www.ontario.ca/document/your-guide-employment-standards-act-0/termination-employment
// Official ladder (employee continuously employed 3+ months):
//   < 3 months .............. 0 weeks (no ESA notice yet)
//   3 months – < 1 year ..... 1 week
//   1 year   – < 3 years .... 2 weeks
//   3 years  – < 4 years .... 3 weeks
//   4 years  – < 5 years .... 4 weeks
//   5 years  – < 6 years .... 5 weeks
//   6 years  – < 7 years .... 6 weeks
//   7 years  – < 8 years .... 7 weeks
//   8 years or more ......... 8 weeks (cap)
export const ONTARIO_ESA = {
  noticeCapWeeks: 8,
  // Returns statutory notice weeks for a given length of service.
  noticeWeeks(years, months) {
    const totalMonths = years * 12 + months;
    if (totalMonths < 3) return 0;   // no entitlement
    if (totalMonths < 12) return 1;  // 3 months to just under a year
    if (totalMonths < 36) return 2;  // 1 year to just under 3 years
    return Math.min(years, 8);       // 3 years+: one week per completed year, cap 8
  },

  // [ESA] Statutory SEVERANCE PAY (s.64) — a SEPARATE entitlement from notice above.
  // Verified 2026-07-12 against:
  // https://www.ontario.ca/document/your-guide-employment-standards-act-0/severance-pay
  // Qualifies when the employee has 5+ years of employment AND either:
  //   (a) the employer has a global payroll of at least $2.5 million; OR
  //   (b) the employer severed 50+ employees in a 6-month period because all or part
  //       of the business permanently closed.
  // Amount = regular weekly wages × (completed years + completed months ÷ 12),
  // to a maximum of 26 weeks.
  severance: {
    minYearsService: 5,
    payrollThreshold: 2500000, // $2.5M global payroll
    massTerminationEmployees: 50,
    massTerminationMonths: 6,
    maxWeeks: 26,
    // Severance weeks for a qualifying employee (before the cap the caller may re-show).
    weeks(years, months) {
      const partial = Math.min(11, Math.max(0, Math.floor(months))) / 12;
      return Math.min(years + partial, 26);
    },
    // True only when the 5-year service floor AND a payroll/mass-termination route are met.
    qualifies(years, months, payrollAtLeast25M, massClosure) {
      const totalMonths = years * 12 + months;
      return totalMonths >= 60 && (payrollAtLeast25M || massClosure);
    },
  },
};

/* ── CANADA CHILD BENEFIT (CCB) — federal, tax-free monthly benefit ─────────── */
// ┌───────────────────────────────────────────────────────────────────────────┐
// │ INDEXED ANNUALLY — DO NOT ASSUME THESE ARE CURRENT.                         │
// │ Unlike the payroll tables above (which update every JANUARY), the CCB is    │
// │ re-indexed to inflation every JULY and runs on a benefit year (July–June).  │
// │ These figures are for the July 2026 → June 2027 benefit year, based on 2025 │
// │ adjusted family net income (AFNI). When CRA publishes the next calculation  │
// │ sheet, replace maxUnder6 / max6to17 / threshold1 / threshold2 below. The    │
// │ reduction PERCENTAGES do not index — they've been fixed since 2016.         │
// └───────────────────────────────────────────────────────────────────────────┘
// Verified 2026-07-12:
//  - Thresholds $38,237 / $82,847 confirmed on canada.ca "How much you can get":
//    https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit/how-much.html
//  - Formula + fixed percentages from the CRA calculation sheet (structure is the
//    same each year; the 2026–27 sheet was not yet published at build time):
//    https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit/canada-child-benefit-calculation-sheets.html
//  - Base amounts $8,157 (under 6) / $6,883 (6–17) are the 2025–26 CRA sheet values
//    ($7,997 / $6,748) indexed +2.0% — the published 2026–27 indexation. [3P — re-confirm
//    against the official 2026–27 calculation sheet when CRA posts it.]
//
// CRA method (from the calculation sheet): total base benefit minus a two-tier
// reduction. Tier 1 applies to AFNI between the two thresholds; tier 2 applies to
// AFNI above the second threshold, on top of the full tier-1 reduction accumulated
// across the band. The "fixed" dollar amounts CRA prints for tier 2 (e.g. $3,061 for
// one child in 2025–26) are exactly (threshold2 − threshold1) × tier1Rate, so we
// derive them rather than hardcode — this stays correct after a threshold update.
export const CCB = {
  benefitYear: 'July 2026 – June 2027',
  baseYear: 2025,
  maxUnder6: 8157,   // [3P] per child under 6, per year
  max6to17: 6883,    // [3P] per child aged 6–17, per year
  threshold1: 38237, // [CRA] AFNI where the phase-out begins
  threshold2: 82847, // [CRA] AFNI where the second, lower reduction rate takes over
  // Reduction rates by number of eligible children (index 0 = 1 child … 3 = 4+).
  // [CRA] Fixed since 2016 — these do NOT index.
  tier1Rates: [0.07, 0.135, 0.19, 0.23],   // AFNI between threshold1 and threshold2
  tier2Rates: [0.032, 0.057, 0.08, 0.095], // AFNI above threshold2

  // Annual benefit reduction for a given AFNI and total number of children.
  reduction(afni, numChildren) {
    if (numChildren < 1 || afni <= this.threshold1) return 0;
    const i = Math.min(numChildren, 4) - 1;
    const band = this.threshold2 - this.threshold1;
    const tier1 = Math.min(Math.max(afni - this.threshold1, 0), band) * this.tier1Rates[i];
    const tier2 = Math.max(afni - this.threshold2, 0) * this.tier2Rates[i];
    return tier1 + tier2;
  },

  // Full unreduced base benefit for the given mix of children.
  baseBenefit(under6, age6to17) {
    return under6 * this.maxUnder6 + age6to17 * this.max6to17;
  },

  // Estimated annual CCB (never negative). Returns { annual, monthly, base, reduction }.
  annual(under6, age6to17, afni) {
    const numChildren = under6 + age6to17;
    const base = this.baseBenefit(under6, age6to17);
    const reduction = this.reduction(afni, numChildren);
    const annual = Math.max(0, base - reduction);
    return { annual, monthly: annual / 12, base, reduction };
  },
};

/* ── LAND TRANSFER TAX (LTT) — Ontario provincial + Toronto municipal ───────── */
// Marginal brackets: each rate applies only to the portion of the price within that
// band. Applies to residential property with one or two single-family residences —
// the case for essentially every home buyer (the top provincial rate and Toronto's
// high-value rates are limited to 1–2 SFR properties).
//
// ┌───────────────────────────────────────────────────────────────────────────┐
// │ NOT CRA-indexed. These are statutory rates set by the Province and the City │
// │ of Toronto; they change only by legislation/by-law, not annual indexation.  │
// │ Re-verify against the official sources below whenever either government     │
// │ amends its rates or first-time-buyer rebate.                                │
// └───────────────────────────────────────────────────────────────────────────┘
// Verified 2026-07-13 against official sources only (no blogs/aggregators):
//  ONTARIO provincial LTT + FTB rebate — ontario.ca:
//    https://www.ontario.ca/document/land-transfer-tax/calculating-land-transfer-tax
//    https://www.ontario.ca/document/land-transfer-tax/land-transfer-tax-refunds-first-time-homebuyers
//    (max first-time-buyer refund $4,000; full rebate up to ~$368,000.)
//  TORONTO municipal LTT (MLTT) — the graduated high-value rates for 1–2 SFR took
//  effect APRIL 1, 2026 (City Council 2025.EX28.1, By-law 132-2026). Confirmed on
//  toronto.ca rates page AND the Council decision text:
//    https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/municipal-land-transfer-tax-mltt-rates-and-fees/
//    https://secure.toronto.ca/council/agenda-item.do?item=2025.EX28.1
//    (Toronto FTB rebate max $4,475; full rebate up to $400,000 — toronto.ca rebate page.)
export const LTT = {
  // Ontario provincial — value of consideration bands. [ontario.ca]
  ontarioBrackets: [
    { upTo: 55000,     rate: 0.005 },
    { upTo: 250000,    rate: 0.010 },
    { upTo: 400000,    rate: 0.015 },
    { upTo: 2000000,   rate: 0.020 },
    { upTo: Infinity,  rate: 0.025 }, // over $2M, property with 1–2 SFR
  ],
  // Toronto MLTT — effective April 1, 2026 (1–2 SFR). [toronto.ca / 2025.EX28.1]
  torontoBrackets: [
    { upTo: 55000,     rate: 0.005 },
    { upTo: 250000,    rate: 0.010 },
    { upTo: 400000,    rate: 0.015 },
    { upTo: 2000000,   rate: 0.020 },
    { upTo: 3000000,   rate: 0.025 },
    { upTo: 4000000,   rate: 0.044 },
    { upTo: 5000000,   rate: 0.0545 },
    { upTo: 10000000,  rate: 0.065 },
    { upTo: 20000000,  rate: 0.0755 },
    { upTo: Infinity,  rate: 0.086 },
  ],
  ontarioFtbRebateMax: 4000, // [ontario.ca] max provincial first-time-buyer refund
  torontoFtbRebateMax: 4475, // [toronto.ca] max municipal first-time-buyer rebate
  torontoRatesEffective: 'April 1, 2026',

  // Marginal tax on a price over a bracket set.
  tax(price, brackets) {
    let tax = 0, prev = 0;
    for (const b of brackets) {
      if (price <= prev) break;
      tax += (Math.min(price, b.upTo) - prev) * b.rate;
      prev = b.upTo;
    }
    return tax;
  },

  // Full estimate. isToronto adds the municipal LTT; firstTimeBuyer applies each
  // rebate (capped at that jurisdiction's max) against its own tax only.
  estimate(price, isToronto, firstTimeBuyer) {
    price = Math.max(0, price);
    const provincial = this.tax(price, this.ontarioBrackets);
    const municipal = isToronto ? this.tax(price, this.torontoBrackets) : 0;
    const provincialRebate = firstTimeBuyer ? Math.min(provincial, this.ontarioFtbRebateMax) : 0;
    const municipalRebate = firstTimeBuyer && isToronto ? Math.min(municipal, this.torontoFtbRebateMax) : 0;
    const total = provincial + municipal - provincialRebate - municipalRebate;
    return { provincial, municipal, provincialRebate, municipalRebate, total };
  },
};

/* ── CPP RETIREMENT PENSION — timing (start at 60 vs 65) ────────────────────── */
// Federal, nationwide (CPP; Quebec's QPP is separate and NOT covered here).
// Verified 2026-07-14 against canada.ca (ESDC):
//   Adjustment rates — "When to start your retirement pension":
//     https://www.canada.ca/en/services/benefits/publicpensions/cpp/cpp-benefit/when-start.html
//     "before age 65 … decrease by 0.6% each month (7.2%/yr), up to 36% at age 60;
//      after age 65 … increase by 0.7% each month (8.4%/yr), up to 42% at age 70."
//   Amounts — "How much you could receive":
//     https://www.canada.ca/en/services/benefits/publicpensions/cpp/cpp-benefit/amount.html
//     Maximum at 65 (January 2026): $1,507.65/month.
//     Average CPP pension at 65 (April 2026): $877.01/month.
// The maximum/average are context only — the calculator REQUIRES the user's own
// estimate from their Service Canada statement and never defaults to these.
// QPP branch verified 2026-07-15 against Retraite Québec:
//   Adjustment factors — "Calculation of your retirement pension":
//     https://www.retraitequebec.gouv.qc.ca/en/citizens/retirement-planning/applying-your-retirement-pension/retirement-pension-quebec-pension-plan/calculation-your-retirement-pension
//     Before 65: pension decreases 0.5%–0.6% PER MONTH — a SLIDING factor, unlike CPP's
//     flat 0.6%. It is 0.5% for a low pension, rising in proportion to 0.6% at the maximum:
//     factor = 0.005 + 0.001 × (pension ÷ maximum pension), capped [0.005, 0.006].
//     After 65: increases 0.7%/month (same as CPP).
//   Max QPP pension at 65 (2026) = $1,507.65 (= CPP max) — "Benefit amounts and key data":
//     https://www.retraitequebec.gouv.qc.ca/en/benefits-amounts-key-data
//     (confirmed: at 60 = 64% of max → 36% reduction → 0.6%/month at the maximum pension).
// Consequence: unlike CPP's constant ~73.9, the QPP break-even age VARIES with the pension
// size — later for a smaller pension (less reduction), ~73.9 only at the maximum.
export const CPP_RETIREMENT = {
  earlyReductionPerMonth: 0.006, // CPP: flat 0.6%/month before 65
  earlyMaxReduction: 0.36,       // CPP: 36% at age 60 (60 months early)
  lateIncreasePerMonth: 0.007,   // 0.7%/month after 65 — reference only, not used on 60-vs-65
  lateMaxIncrease: 0.42,         // 42% at age 70 — reference only
  maxAt65Monthly: 1507.65,       // context only — do NOT prefill the input
  averageAt65Monthly: 877.01,    // context only
  qpp: {
    maxAt65Monthly: 1507.65,     // [Retraite Québec] max QPP pension at 65, 2026
    earlyReductionMin: 0.005,    // 0.5%/month for a low pension
    earlyReductionMax: 0.006,    // 0.6%/month at the maximum pension
    lateIncreasePerMonth: 0.007, // 0.7%/month after 65 (same as CPP)
  },

  // Early monthly reduction factor. CPP is flat 0.6%; QPP slides 0.5%→0.6% with pension size.
  earlyReductionFactor(monthlyAt65, plan = 'CPP') {
    if (plan !== 'QPP') return this.earlyReductionPerMonth;
    const q = this.qpp;
    const ratio = Math.max(0, Math.min(1, monthlyAt65 / q.maxAt65Monthly));
    return q.earlyReductionMin + (q.earlyReductionMax - q.earlyReductionMin) * ratio;
  },

  // Monthly pension if started at `startAge` (60–65 for this page), given the amount
  // payable at 65. Reduction = (per-month factor) × months-before-65.
  monthlyAtStart(monthlyAt65, startAge, plan = 'CPP') {
    const monthsEarly = Math.max(0, Math.min(60, (65 - startAge) * 12));
    return monthlyAt65 * (1 - this.earlyReductionFactor(monthlyAt65, plan) * monthsEarly);
  },

  // Break-even age for start-at-60 vs start-at-65, in years. The early starter banks
  // (monthlyAt60 × 60) by age 65; after 65 the later, larger pension closes that lead at
  // (monthlyAt65 − monthlyAt60) per month. Those catch-up months fall AFTER 65, so the
  // break-even age is 65 + months/12. For CPP this is ~73.9 for everyone (flat 36%); for
  // QPP it depends on the pension size (the reduction slides with it).
  breakEvenAge(monthlyAt65, plan = 'CPP') {
    const at60 = this.monthlyAtStart(monthlyAt65, 60, plan);
    const diff = monthlyAt65 - at60;
    if (diff <= 0) return null;
    const monthsAfter65 = (at60 * 60) / diff;
    return 65 + monthsAfter65 / 12;
  },

  // Cumulative pension dollars collected by `atAge` if started at `startAge`
  // (nominal, before inflation indexing, investment returns or tax).
  cumulativeBy(monthlyAmount, startAge, atAge) {
    const months = Math.max(0, (atAge - startAge) * 12);
    return monthlyAmount * months;
  },
};

/* ── EI MATERNITY & PARENTAL BENEFITS — federal, nationwide EXCEPT Quebec ────── */
// Quebec runs its own QPIP (Québec Parental Insurance Plan) with different rates and
// weeks — NOT modelled here. Verified 2026-07-14 against canada.ca (Service Canada):
//   "What these benefits offer" (weeks table) —
//     https://www.canada.ca/en/services/benefits/ei/ei-maternity-parental.html
//   "How much you could receive" (rates + 2026 weekly maximums) —
//     https://www.canada.ca/en/services/benefits/ei/ei-maternity-parental/benefit-amount.html
//   "After you apply" (1-week unpaid waiting period) —
//     https://www.canada.ca/en/services/benefits/ei/ei-maternity-parental/after-applying.html
// Official 2026 table:
//   Maternity (birth parent only, not shareable): up to 15 weeks @ 55%, max $729/wk
//   Standard parental: up to 40 wks shared / 35 wks one parent @ 55%, max $729/wk
//   Extended parental: up to 69 wks shared / 61 wks one parent @ 33%, max $437/wk
// Maternity is ALWAYS paid at 55% — the standard/extended choice only affects PARENTAL.
export const EI_PARENTAL = {
  standardRate: 0.55,
  extendedRate: 0.33,
  maxWeeklyStandard: 729, // [canada.ca] 2026 (= 55% of $68,900 MIE ÷ 52)
  maxWeeklyExtended: 437, // [canada.ca] 2026 (= 33% of $68,900 MIE ÷ 52)
  maternityWeeks: 15,
  standardParental: { oneParent: 35, shared: 40 }, // sharing adds 5 weeks (2nd parent's)
  extendedParental: { oneParent: 61, shared: 69 }, // sharing adds 8 weeks (2nd parent's)
  waitingPeriodWeeks: 1, // one unpaid week at the start of the claim
  familySupplementIncomeThreshold: 25921, // [canada.ca] Family Supplement (up to 80%) — NOT modelled

  weeklyStandard(avgWeekly) {
    return Math.min(Math.round(avgWeekly * this.standardRate), this.maxWeeklyStandard);
  },
  weeklyExtended(avgWeekly) {
    return Math.min(Math.round(avgWeekly * this.extendedRate), this.maxWeeklyExtended);
  },

  // Compare the standard vs extended path. `includeMaternity` adds 15 maternity weeks
  // (always at 55%); `sharing` unlocks the shared parental cap (extra weeks are the
  // second parent's, estimated here at the same earnings). Totals are nominal, pre-tax.
  estimate(avgWeekly, includeMaternity, sharing) {
    const wStd = this.weeklyStandard(avgWeekly);
    const wExt = this.weeklyExtended(avgWeekly);
    const matWeeks = includeMaternity ? this.maternityWeeks : 0;
    const stdParental = sharing ? this.standardParental.shared : this.standardParental.oneParent;
    const extParental = sharing ? this.extendedParental.shared : this.extendedParental.oneParent;
    const matPay = matWeeks * wStd; // maternity always at the 55% rate
    return {
      maternityWeekly: wStd,
      standard: {
        parentalWeekly: wStd,
        maternityWeeks: matWeeks,
        parentalWeeks: stdParental,
        totalWeeks: matWeeks + stdParental,
        total: matPay + stdParental * wStd,
      },
      extended: {
        parentalWeekly: wExt,
        maternityWeeks: matWeeks,
        parentalWeeks: extParental,
        totalWeeks: matWeeks + extParental,
        total: matPay + extParental * wExt,
      },
    };
  },
};

/* ── QPIP MATERNITY / PARENTAL BENEFITS — Quebec's replacement for federal EI ── */
// Quebec residents use the Québec Parental Insurance Plan (QPIP), NOT federal EI. QPIP
// has its own two-plan structure (Basic = longer, lower %; Special = shorter, higher %),
// its own weeks/percentages per benefit type, its own MIE ($103,000, not EI's $68,900),
// and NO waiting period (EI has one unpaid week). Verified 2026-07-15:
//   Benefit weeks + percentages — quebec.ca "Choice of Plan and Types of Benefits":
//     https://www.quebec.ca/en/family-and-support-for-individuals/pregnancy-parenthood/financial-support-pregnant-women-families/quebec-parental-insurance-plan/pregnancy-childbirth/choice-plan
//   MIE $103,000 (2026) — quebec.ca "How is the benefit amount determined".
// Official 2026 table:
//   Basic  : maternity 18 wk @70%; paternity 5 wk @70%; parental 32 wk (7 @70% + 25 @55%);
//            +4 shareable wk @55% when each parent takes ≥8 shareable weeks.
//   Special: maternity 15 wk @75%; paternity 3 wk @75%; parental 25 wk @75%;
//            +3 shareable wk @75% when each parent takes ≥6 shareable weeks.
// NO-WAITING-PERIOD FLAG: modelled as 0 weeks. An explicit "no waiting period" sentence
// was not located on the reachable RQAP/quebec.ca pages (the site migration redirects
// several deep links to hubs); the benefit-start-date page shows benefits payable from the
// interruption-of-earnings date with no unpaid week, consistent with QPIP's design. Adoption
// benefits differ again (no maternity/paternity) and are NOT modelled — see gap list.
export const QPIP_PARENTAL = {
  maxInsurableEarnings: 103000,
  waitingPeriodWeeks: 0, // QPIP has no waiting period (EI has 1 unpaid week)
  basic: {   // long term, lower percentage
    maternityWeeks: 18, paternityWeeks: 5, exclusiveRate: 0.70,
    parentalWeeks1: 7, parentalRate1: 0.70, parentalWeeks2: 25, parentalRate2: 0.55,
    sharedBonusWeeks: 4, sharedBonusRate: 0.55, rateLabel: '70% → 55%',
  },
  special: { // short term, higher percentage
    maternityWeeks: 15, paternityWeeks: 3, exclusiveRate: 0.75,
    parentalWeeks: 25, parentalRate: 0.75,
    sharedBonusWeeks: 3, sharedBonusRate: 0.75, rateLabel: '75%',
  },

  // Weekly benefit at a given replacement rate, capped at the QPIP MIE (rounded to $1).
  weeklyAt(avgWeekly, rate) {
    return Math.round(Math.min(avgWeekly, this.maxInsurableEarnings / 52) * rate);
  },

  // Compare Basic vs Special for one parent. `isBirthParent` picks maternity (else
  // paternity); `sharing` adds the shareable-parental bonus weeks (household). Totals are
  // nominal and pre-tax. Adoption is out of scope (different weeks, no maternity/paternity).
  estimate(avgWeekly, isBirthParent, sharing) {
    const b = this.basic, s = this.special;
    const bExcl = isBirthParent ? b.maternityWeeks : b.paternityWeeks;
    const bBonusWk = sharing ? b.sharedBonusWeeks : 0;
    const bWeeks = bExcl + b.parentalWeeks1 + b.parentalWeeks2 + bBonusWk;
    const bTotal = bExcl * this.weeklyAt(avgWeekly, b.exclusiveRate)
      + b.parentalWeeks1 * this.weeklyAt(avgWeekly, b.parentalRate1)
      + b.parentalWeeks2 * this.weeklyAt(avgWeekly, b.parentalRate2)
      + bBonusWk * this.weeklyAt(avgWeekly, b.sharedBonusRate);
    const sExcl = isBirthParent ? s.maternityWeeks : s.paternityWeeks;
    const sBonusWk = sharing ? s.sharedBonusWeeks : 0;
    const sWeeks = sExcl + s.parentalWeeks + sBonusWk;
    const sTotal = sExcl * this.weeklyAt(avgWeekly, s.exclusiveRate)
      + (s.parentalWeeks + sBonusWk) * this.weeklyAt(avgWeekly, s.parentalRate);
    return {
      basic:   { totalWeeks: bWeeks, total: bTotal, avgWeekly: Math.round(bTotal / bWeeks),
                 exclusiveWeeks: bExcl, parentalWeeks: b.parentalWeeks1 + b.parentalWeeks2 + bBonusWk, rateLabel: b.rateLabel },
      special: { totalWeeks: sWeeks, total: sTotal, avgWeekly: Math.round(sTotal / sWeeks),
                 exclusiveWeeks: sExcl, parentalWeeks: s.parentalWeeks + sBonusWk, rateLabel: s.rateLabel },
    };
  },
};
