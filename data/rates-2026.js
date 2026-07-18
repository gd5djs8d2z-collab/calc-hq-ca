/**
 * rates-2026.js — runtime tax/payroll constants + benefit-program data for calc-hq.ca.
 *
 * The income-tax and payroll constants (FEDERAL, CPP, EI, PROVINCES) are DERIVED from the
 * provenance-tracked SOURCE OF TRUTH in ./tax-constants-2026.js — this file just unwraps
 * each { value, source_url, last_verified } node into the plain numbers the tax engine and
 * every calculator consume. To change a tax number, edit tax-constants-2026.js, not here.
 *
 * The benefit-program objects lower down (ONTARIO_ESA, CCB, LTT, CPP_RETIREMENT,
 * EI_PARENTAL, QPIP_PARENTAL) are derived the same way as of 2026-07-18 — every constant
 * they hold now lives in tax-constants-2026.js with a source_url, last_verified date and
 * update cadence, so the staleness checker (scripts/check-constants.mjs) can see it.
 * What stays here is BEHAVIOUR ONLY: the ladders, phase-outs and estimate() methods.
 * To change a number, edit tax-constants-2026.js. Do not reintroduce literals here.
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
  selfEmployedMultiplier: v(TC.cpp.selfEmployedMultiplier),
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
  selfEmployedMultiplier: v(TC.qpp.selfEmployedMultiplier),
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

/* ── QUEBEC — federal-side adjustments ───────────────────────────────────── */
// Refundable Quebec abatement — 16.5% of BASIC federal tax (T1 line 42900 → 44000).
export const QUEBEC = {
  federalAbatementRate: v(TC.quebec.federalAbatementRate),
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
    bpaCreditRate: v(p.bpaCreditRate),
    surtax: p.surtax ? v(p.surtax) : [],
    healthPremium: p.healthPremium ? v(p.healthPremium) : [],
  };
  if (p.healthPremiumMax !== undefined) out.healthPremiumMax = v(p.healthPremiumMax);
  if (p.taxReduction) out.taxReduction = v(p.taxReduction);
  if (p.bpaPhaseOut) out.bpaPhaseOut = v(p.bpaPhaseOut);
  if (p.includesCanadaEmploymentAmount) out.includesCanadaEmploymentAmount = true;
  if (p.bpaBundlesContributions) out.bpaBundlesContributions = true;
  if (p.workerDeduction) out.workerDeduction = v(p.workerDeduction);
  return out;
}

export const PROVINCES = Object.fromEntries(
  Object.entries(TC.provinces).map(([code, p]) => [code, buildProvince(p)])
);

/* ── SHIP GATE ───────────────────────────────────────────────────────────── */
// Which jurisdictions the calculators are allowed to compute for. All 13 are now live:
// Quebec's QPP/QPIP/16.5% abatement and its own brackets/BPA are fully wired.
export const PROVINCE_STATUS = {
  ON: 'live', AB: 'live', BC: 'live', SK: 'live', MB: 'live', NS: 'live',
  NB: 'live', NL: 'live', PE: 'live', YT: 'live', NT: 'live', NU: 'live', QC: 'live',
};
export const LIVE_PROVINCES = ['ON', 'AB', 'BC', 'SK', 'MB', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU', 'QC'];
export const PROVINCE_ORDER = ['ON', 'AB', 'BC', 'SK', 'MB', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU', 'QC'];

/* ── ONTARIO EMPLOYMENT STANDARDS ACT ─────────────────────────────────────── */
// Statutory minimums only — NOT common-law reasonable notice. All values derived from
// TC.ontarioEsa (stamped: ontario.ca ESA guide, statutory cadence). Behaviour only here.
// s.57 notice ladder (employee continuously employed 3+ months):
//   < 3 months .............. 0 weeks (no ESA notice yet)
//   3 months – < 1 year ..... 1 week
//   1 year   – < 3 years .... 2 weeks
//   3 years+ ................ 1 week per completed year, cap 8 at 8 years or more
const ESA = TC.ontarioEsa;
export const ONTARIO_ESA = {
  noticeLadder:   v(ESA.noticeLadder),
  noticeCapWeeks: v(ESA.noticeCapWeeks),
  // Returns statutory notice weeks for a given length of service.
  noticeWeeks(years, months) {
    const totalMonths = years * 12 + months;
    for (const step of this.noticeLadder) {
      if (totalMonths < step.underMonths) return step.weeks;
    }
    return Math.min(years, this.noticeCapWeeks); // 3 years+: one week per completed year
  },

  // Statutory SEVERANCE PAY (s.64) — a SEPARATE entitlement from notice above. Qualifies
  // when the employee has 5+ years of employment AND either (a) the employer has a global
  // payroll of at least $2.5M, or (b) the employer severed 50+ employees in a 6-month
  // period because all or part of the business permanently closed. Amount = regular weekly
  // wages × (completed years + completed months ÷ 12), to a maximum of 26 weeks.
  severance: {
    minYearsService:          v(ESA.severanceMinYearsService),
    payrollThreshold:         v(ESA.severancePayrollThreshold),
    massTerminationEmployees: v(ESA.severanceMassTerminationCount),
    massTerminationMonths:    v(ESA.severanceMassTerminationMonths),
    maxWeeks:                 v(ESA.severanceMaxWeeks),
    // Severance weeks for a qualifying employee (before the cap the caller may re-show).
    weeks(years, months) {
      const partial = Math.min(11, Math.max(0, Math.floor(months))) / 12;
      return Math.min(years + partial, this.maxWeeks);
    },
    // True only when the service floor AND a payroll/mass-termination route are met.
    qualifies(years, months, payrollAtLeast25M, massClosure) {
      const totalMonths = years * 12 + months;
      return totalMonths >= this.minYearsService * 12 && (payrollAtLeast25M || massClosure);
    },
  },

  // OVERTIME PAY (s.22) — 1½× the regular rate for hours worked over 44 in a work WEEK
  // (weekly basis; no daily overtime unless a contract says so). Managers/supervisors and
  // many occupations are exempt or have a different threshold — NOT modelled here;
  // flagged in the page content.
  overtime: {
    thresholdHours: v(ESA.overtimeThresholdHours),
    multiplier:     v(ESA.overtimeMultiplier),
    // Split a week's hours into { regular, overtime } at the 44-hour line.
    split(hours) {
      const regular = Math.min(Math.max(0, hours), this.thresholdHours);
      const overtime = Math.max(0, hours - this.thresholdHours);
      return { regular, overtime };
    },
  },

  // VACATION PAY (s.35.2) — at least 4% of gross wages for employees with LESS than 5
  // years of employment, at least 6% at 5+ years; vacation TIME is 2 weeks (<5 yrs) /
  // 3 weeks (5+ yrs). Gross wages exclude vacation pay itself.
  vacation: {
    yearsCutoff: v(ESA.vacationYearsCutoff),
    rateUnder5:  v(ESA.vacationRateUnder5),
    rate5Plus:   v(ESA.vacationRate5Plus),
    weeksUnder5: v(ESA.vacationWeeksUnder5),
    weeks5Plus:  v(ESA.vacationWeeks5Plus),
    rate(years)  { return years >= this.yearsCutoff ? this.rate5Plus : this.rateUnder5; },
    weeks(years) { return years >= this.yearsCutoff ? this.weeks5Plus : this.weeksUnder5; },
  },
};

/* ── CANADA CHILD BENEFIT (CCB) — federal, tax-free monthly benefit ─────────── */
// Constants + provenance: TC.ccb (cadence 'july' — the CCB re-indexes every JULY on a
// July–June benefit year, NOT in January like the payroll tables above; the reduction
// percentages are marked 'statutory' because they have been fixed since 2016).
//
// CRA method (from the calculation sheet): total base benefit minus a two-tier
// reduction. Tier 1 applies to AFNI between the two thresholds; tier 2 applies to
// AFNI above the second threshold, on top of the full tier-1 reduction accumulated
// across the band. The "fixed" dollar amounts CRA prints for tier 2 (e.g. $3,061 for
// one child in 2025–26) are exactly (threshold2 − threshold1) × tier1Rate, so we
// derive them rather than hardcode — this stays correct after a threshold update.
export const CCB = {
  benefitYear: v(TC.ccb.benefitYear),
  baseYear:    v(TC.ccb.baseYear),
  maxUnder6:   v(TC.ccb.maxUnder6),   // per child under 6, per year
  max6to17:    v(TC.ccb.max6to17),    // per child aged 6–17, per year
  threshold1:  v(TC.ccb.threshold1),  // AFNI where the phase-out begins
  threshold2:  v(TC.ccb.threshold2),  // AFNI where the second, lower reduction rate takes over
  // Reduction rates by number of eligible children (index 0 = 1 child … 3 = 4+).
  // Fixed since 2016 — these do NOT index.
  tier1Rates:  v(TC.ccb.tier1Rates),  // AFNI between threshold1 and threshold2
  tier2Rates:  v(TC.ccb.tier2Rates),  // AFNI above threshold2

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
// Constants + provenance: TC.ltt (cadence 'statutory' — these are rates set by the
// Province and the City of Toronto and change only by legislation/by-law, never by annual
// indexation; re-verify whenever either government amends its rates or its FTB rebate).
export const LTT = {
  // Ontario provincial — value of consideration bands.
  ontarioBrackets: v(TC.ltt.ontarioBrackets),
  // Toronto MLTT — graduated high-value rates for 1–2 SFR, effective April 1, 2026.
  torontoBrackets: v(TC.ltt.torontoBrackets),
  ontarioFtbRebateMax:   v(TC.ltt.ontarioFtbRebateMax), // max provincial first-time-buyer refund
  torontoFtbRebateMax:   v(TC.ltt.torontoFtbRebateMax), // max municipal first-time-buyer rebate
  torontoRatesEffective: v(TC.ltt.torontoRatesEffective),

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
// Constants + provenance: TC.cppRetirement. Adjustment factors are set in the CPP Act
// (cadence 'statutory'); the CPP maximum re-indexes each January and the published
// average is refreshed through the year (cadence 'quarterly').
// QPP differs: before 65 the pension decreases 0.5%–0.6% PER MONTH — a SLIDING factor,
// unlike CPP's flat 0.6%. It is 0.5% for a low pension, rising in proportion to 0.6% at
// the maximum: factor = 0.005 + 0.001 × (pension ÷ maximum pension), capped [0.005, 0.006].
// After 65 it increases 0.7%/month, same as CPP.
// The maximum/average are context only — the calculator REQUIRES the user's own estimate
// from their Service Canada statement and never defaults to these.
// Consequence: unlike CPP's constant ~73.9, the QPP break-even age VARIES with the pension
// size — later for a smaller pension (less reduction), ~73.9 only at the maximum.
export const CPP_RETIREMENT = {
  earlyReductionPerMonth: v(TC.cppRetirement.earlyReductionPerMonth), // CPP: flat 0.6%/month before 65
  earlyMaxReduction:      v(TC.cppRetirement.earlyMaxReduction),      // CPP: 36% at age 60 (60 months early)
  lateIncreasePerMonth:   v(TC.cppRetirement.lateIncreasePerMonth),   // after 65 — reference only, not used on 60-vs-65
  lateMaxIncrease:        v(TC.cppRetirement.lateMaxIncrease),        // at age 70 — reference only
  maxAt65Monthly:         v(TC.cppRetirement.maxAt65Monthly),         // context only — do NOT prefill the input
  averageAt65Monthly:     v(TC.cppRetirement.averageAt65Monthly),     // context only
  qpp: {
    maxAt65Monthly:       v(TC.cppRetirement.qppMaxAt65Monthly),
    earlyReductionMin:    v(TC.cppRetirement.qppEarlyReductionMin),    // for a low pension
    earlyReductionMax:    v(TC.cppRetirement.qppEarlyReductionMax),    // at the maximum pension
    lateIncreasePerMonth: v(TC.cppRetirement.qppLateIncreasePerMonth), // after 65 (same as CPP)
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
// weeks — modelled separately below, not here.
// Constants + provenance: TC.eiParental. Weeks and replacement rates are set in the EI Act
// (cadence 'statutory'); the weekly MAXIMUMS and the Family Supplement threshold move with
// the MIE every January (cadence 'january').
// Maternity is ALWAYS paid at 55% — the standard/extended choice only affects PARENTAL.
export const EI_PARENTAL = {
  standardRate:       v(TC.eiParental.standardRate),
  extendedRate:       v(TC.eiParental.extendedRate),
  maxWeeklyStandard:  v(TC.eiParental.maxWeeklyStandard), // = 55% of the MIE ÷ 52
  maxWeeklyExtended:  v(TC.eiParental.maxWeeklyExtended), // = 33% of the MIE ÷ 52
  maternityWeeks:     v(TC.eiParental.maternityWeeks),
  standardParental:   v(TC.eiParental.standardParental), // sharing adds 5 weeks (2nd parent's)
  extendedParental:   v(TC.eiParental.extendedParental), // sharing adds 8 weeks (2nd parent's)
  waitingPeriodWeeks: v(TC.eiParental.waitingPeriodWeeks), // one unpaid week at the start of the claim
  familySupplementIncomeThreshold: v(TC.eiParental.familySupplementIncomeThreshold), // up to 80% — NOT modelled

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
// and NO waiting period (EI has one unpaid week).
// Constants + provenance: TC.qpipParental. Weeks and percentages are 'statutory'; the MIE
// re-indexes each January. The NO-WAITING-PERIOD FLAG and the adoption-benefits scope gap
// are documented on the constants block.
export const QPIP_PARENTAL = {
  maxInsurableEarnings: v(TC.qpipParental.maxInsurableEarnings),
  waitingPeriodWeeks:   v(TC.qpipParental.waitingPeriodWeeks), // QPIP has none (EI has 1 unpaid week)
  basic:   v(TC.qpipParental.basic),   // long term, lower percentage
  special: v(TC.qpipParental.special), // short term, higher percentage

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

/* ── KEY DATES & LIMITS (2026) — registered-account limits + CRA tax deadlines ── */
// Derived from TC.registeredAccounts / TC.taxDeadlines2026 (provenance-stamped in
// tax-constants-2026.js). The reference pages hardcode the figures in prose; the
// tax-deadline countdown widget imports KEY_DATES so its dates can't drift from source.
export const REGISTERED_LIMITS = {
  tfsaAnnualLimit: v(TC.registeredAccounts.tfsaAnnualLimit),
  tfsaCumulativeSince2009: v(TC.registeredAccounts.tfsaCumulativeSince2009),
  rrspDollarLimit: v(TC.registeredAccounts.rrspDollarLimit),
  rrspEarnedIncomePct: v(TC.registeredAccounts.rrspEarnedIncomePct),
  fhsaAnnualLimit: v(TC.registeredAccounts.fhsaAnnualLimit),
  fhsaLifetimeLimit: v(TC.registeredAccounts.fhsaLifetimeLimit),
  respLifetimeLimit: v(TC.registeredAccounts.respLifetimeLimit),
  cesgRate: v(TC.registeredAccounts.cesgRate),
  cesgMaxPerYear: v(TC.registeredAccounts.cesgMaxPerYear),
  cesgFullGrantContribution: v(TC.registeredAccounts.cesgFullGrantContribution),
  cesgLifetimeMax: v(TC.registeredAccounts.cesgLifetimeMax),
};

export const KEY_DATES = {
  personalFiling: v(TC.taxDeadlines2026.personalFiling),
  payment: v(TC.taxDeadlines2026.payment),
  selfEmployedFiling: v(TC.taxDeadlines2026.selfEmployedFiling),
  rrspContribution: v(TC.taxDeadlines2026.rrspContribution),
  instalments: v(TC.taxDeadlines2026.instalments),
};

/* ── GUARANTEED INCOME SUPPLEMENT (GIS) ────────────────────────────────────── */
// Derived from TC.gis (provenance-stamped, effective July–September 2026). GIS is indexed
// QUARTERLY, so this re-verifies on a quarterly cadence, not the January one.
// MODEL: Service Canada retired its per-income GIS rate tables (now an online estimator), so
// only the maxima and income cut-offs are published. estimate() applies a LINEAR phase-out
// from the maximum (at $0 countable income) to $0 (at the cut-off) — exact at both verified
// endpoints. The true reduction is piecewise ($1 per $2 base, plus a steeper top-up band at
// low income); this is a documented estimate, and the page tells users to confirm the exact
// figure with the Service Canada Benefits Estimator.
export const GIS = {
  effectiveQuarter: v(TC.gis.effectiveQuarter),
  oasEligibilityAge: v(TC.gis.oasEligibilityAge),
  status: {
    single: v(TC.gis.single),
    spouseFullOAS: v(TC.gis.spouseFullOAS),
    spouseAllowance: v(TC.gis.spouseAllowance),
    spouseNoOAS: v(TC.gis.spouseNoOAS),
  },
  employmentExemption: v(TC.gis.employmentExemption),

  // Countable employment/self-employment income after the exemption (per person):
  // first $5,000 fully exempt, then 50% of the next $10,000.
  netEmployment(emp) {
    emp = Math.max(0, emp);
    const e = this.employmentExemption;
    const partialExempt = Math.min(Math.max(0, emp - e.full), e.partialUpTo) * e.partialRate;
    return Math.max(0, emp - Math.min(emp, e.full) - partialExempt);
  },

  // Estimated monthly + annual GIS. countableIncome = income counted by the GIS test
  // (couples: combined), already excluding OAS and net of the employment exemption.
  estimate(statusKey, countableIncome) {
    const s = this.status[statusKey];
    if (!s) return null;
    countableIncome = Math.max(0, countableIncome);
    const fraction = Math.max(0, 1 - countableIncome / s.incomeCutoff);
    const monthly = s.maxMonthly * fraction;
    return {
      monthly, annual: monthly * 12,
      maxMonthly: s.maxMonthly, incomeCutoff: s.incomeCutoff,
      reductionMonthly: s.maxMonthly - monthly,
      atOrOverCutoff: countableIncome >= s.incomeCutoff,
    };
  },
};

/* ── BENEFIT PAYMENT DATES (2026) ──────────────────────────────────────────── */
// Derived from TC.benefitPaymentDates2026 (provenance-stamped, CRA payment-dates page,
// verified 2026-07-18). Powers the /key-dates-limits/ccb-payment-dates/ countdown, so the
// dates can't drift from source. Re-verify every January when CRA publishes the new year.
export const BENEFIT_PAYMENT_DATES = {
  ccb: v(TC.benefitPaymentDates2026.ccb),
  gstCredit: v(TC.benefitPaymentDates2026.gstCredit),
  groceriesEssentials: v(TC.benefitPaymentDates2026.groceriesEssentials),
  ontarioTrillium: v(TC.benefitPaymentDates2026.ontarioTrillium),
  // One Service Canada schedule shared by CPP, OAS and GIS — see the constants block.
  cppOasGis: v(TC.benefitPaymentDates2026.cppOasGis),
};
