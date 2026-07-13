/**
 * rates-2026.js — Canadian payroll/tax constants for the 2026 tax year.
 *
 * SINGLE SOURCE OF TRUTH. The annual update is one edit: replace this file each
 * January when CRA publishes the new T4032 tables. Every calculator imports from here.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ GOLDEN RULE: A HUMAN MUST VERIFY EVERY NUMBER AGAINST THE PRIMARY SOURCE │
 * │ (canada.ca T4032 / provincial TD1) BEFORE THIS SHIPS ON A LIVE TOOL.     │
 * │ Confidence markers below:                                               │
 * │   [CRA]    = confirmed from canada.ca (CRA T4032 or TD1 page)           │
 * │   [3P]     = from a third-party source; corroborate against CRA         │
 * │   [VERIFY] = NOT yet locked from a primary source — DO NOT SHIP AS-IS    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Sources used:
 *  - CRA T4032 payroll tables (federal + per-province general info pages), canada.ca
 *    https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables.html
 *  - CRA TD1 / TD1ON / TD1AB / TD1BC personal tax credit return pages, canada.ca
 *    https://www.canada.ca/en/revenue-agency/services/forms-publications/td1-personal-tax-credits-returns.html
 *  Federal indexation for 2026 = 2.0%. Lowest federal rate is 14% (first full year).
 *
 * SHIP STATUS FOR THIS BUILD: Ontario (ON) and Alberta (AB) are live. British
 * Columbia (BC) and Quebec (QC) are stubs — their figures are not locked, so the
 * calculators must NOT compute for them. See PROVINCE_STATUS / LIVE_PROVINCES below.
 */
export const TAX_YEAR = 2026;

/* ── FEDERAL ─────────────────────────────────────────────────────────────── */
export const FEDERAL = {
  // [CRA] Brackets: rate applies to income *within* [min, max]. Marginal stacking.
  brackets: [
    { min: 0,      max: 58523,    rate: 0.14 },   // [CRA] lowest rate now 14%
    { min: 58523,  max: 117045,   rate: 0.205 },
    { min: 117045, max: 181440,   rate: 0.26 },
    { min: 181440, max: 258482,   rate: 0.29 },
    { min: 258482, max: Infinity, rate: 0.33 },
  ],
  // [CRA] Basic Personal Amount phases DOWN for high earners.
  bpa: {
    max: 16452,            // [CRA] full BPA if net income <= 181440
    min: 14829,            // [CRA] floor for net income >= 258482
    phaseOutStart: 181440, // [CRA]
    phaseOutEnd: 258482,   // [CRA]
    creditRate: 0.14,      // credit = BPA * lowest rate
  },
  // [CRA] Canada Employment Amount — credit value maxes at $210.14 (= CEA base * 14%).
  // Pull the CEA base amount from T4032 Chart 1 if you model it explicitly. [VERIFY base]
  canadaEmploymentAmountMaxCredit: 210.14,
};

/* ── CPP / CPP2 (federal, all provinces except Quebec → see QPP note) ─────── */
export const CPP = {
  // [CRA] Base CPP (CPP1)
  rate: 0.0595,
  basicExemption: 3500,
  ympe: 74600,                      // [CRA] Year's Max Pensionable Earnings
  maxEmployeeContribution: 4230.45, // [CRA]
  // [CRA] CPP2 — second tier on earnings between YMPE and YAMPE
  cpp2: {
    rate: 0.04,
    yampe: 85000,        // [CRA] Year's Additional Max Pensionable Earnings
    maxContribution: 416, // [CRA]
  },
  // Combined employee max across CPP1 + CPP2 = 4646.45. [3P — arithmetic check]
  // SELF-EMPLOYED PAY BOTH HALVES: double the rates AND the dollar maxes.
  // (One source wrongly listed the self-employed max as the employee-only figure.)
  selfEmployedMultiplier: 2,
  // Enhancement split: of the 5.95% CPP1 rate, 1.00% is the "enhanced" portion
  // (deductible from income); the base 4.95% earns a non-refundable credit. CPP2 is
  // entirely enhanced (deductible). Used for accurate net-pay modelling.
  enhancedCpp1Rate: 0.01,
  baseCpp1Rate: 0.0495,
};

/* ── EI (federal; Quebec has its own lower rate + QPIP) ──────────────────── */
export const EI = {
  rate: 0.0163,               // [CRA]
  maxInsurableEarnings: 68900, // [CRA]
  maxEmployeePremium: 1123.07, // [CRA]
  employerRate: 0.0228,        // [CRA]
  maxEmployerPremium: 1572.30, // [CRA]
  benefitReplacementRate: 0.55, // [CRA] regular benefits pay 55% of avg weekly insurable earnings
  quebec: {                    // Quebec residents pay reduced EI (QPIP covers parental)
    rate: 0.0130,              // [CRA]
    maxEmployeePremium: 895.70, // [CRA]
  },
};

/* ── PROVINCES ───────────────────────────────────────────────────────────── */
export const PROVINCES = {
  /* ONTARIO — flagship; fully built. */
  ON: {
    name: 'Ontario',
    indexation: 0.019, // [CRA] 1.9%
    // [3P] thresholds corroborated across sources; $150k & $220k NOT indexed.
    brackets: [
      { min: 0,      max: 53891,    rate: 0.0505 },
      { min: 53891,  max: 107785,   rate: 0.0915 },
      { min: 107785, max: 150000,   rate: 0.1116 },
      { min: 150000, max: 220000,   rate: 0.1216 },
      { min: 220000, max: Infinity, rate: 0.1316 },
    ],
    bpa: 12989,          // [CRA] TD1ON 2026
    bpaCreditRate: 0.0505,
    // [CRA] Ontario surtax — applied to BASIC ONTARIO TAX (after BPA credit), not income.
    surtax: [
      { over: 5818, rate: 0.20 }, // [CRA] 20% on basic ON tax over $5,818
      { over: 7446, rate: 0.36 }, // [CRA] +36% on basic ON tax over $7,446 (cumulative)
    ],
    // [CRA] Ontario Health Premium — flat slabs, added after tax. Full 2026 schedule
    // per CRA T4032-ON: six bands, not indexed, topping out at $900 above ~$200,600.
    healthPremium: [
      { upTo: 20000, premium: 0 },
      { upTo: 36000, formula: 'lesser(300, 0.06*(income-20000))' },     // [CRA]
      { upTo: 48000, formula: 'lesser(450, 300+0.06*(income-36000))' },   // [CRA]
      { upTo: 72000, formula: 'lesser(600, 450+0.25*(income-48000))' },   // [CRA]
      { upTo: 200000, formula: 'lesser(750, 600+0.25*(income-72000))' },   // [CRA]
      { upTo: Infinity, formula: 'lesser(900, 750+0.25*(income-200000))' }, // [CRA]
    ],
    healthPremiumMax: 900, // [CRA] OHP tops out at $900
  },

  /* ALBERTA — BPA + first-bracket rate CRA-confirmed; thresholds 3P. */
  AB: {
    name: 'Alberta',
    indexation: 0.02, // [CRA] 2.0%
    // [3P] 8% first bracket (new, full-year in 2026); thresholds indexed 2%.
    brackets: [
      { min: 0,      max: 61200,    rate: 0.08 }, // [CRA rate] / [3P threshold]
      { min: 61200,  max: 154259,   rate: 0.10 },
      { min: 154259, max: 185111,   rate: 0.12 },
      { min: 185111, max: 246813,   rate: 0.13 },
      { min: 246813, max: 370220,   rate: 0.14 },
      { min: 370220, max: Infinity, rate: 0.15 },
    ],
    bpa: 22769,        // [CRA] TD1AB 2026
    bpaCreditRate: 0.08,
    surtax: [],        // Alberta has no surtax
    healthPremium: [], // Alberta has no health premium
  },

  /* BRITISH COLUMBIA — STUB. BPA + lowest rate CRA-confirmed; THRESHOLDS NOT LOCKED.
     Do not compute for BC in this build. */
  BC: {
    name: 'British Columbia',
    indexation: 0.022, // [CRA] 2.2% (then paused 2027–2030 per Budget 2026)
    // [VERIFY] Lowest rate rose to 5.6% (from 5.06%) for 2026 — CONFIRMED.
    // Bracket THRESHOLDS below are placeholders — pull exact 2026 numbers from:
    // https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates
    brackets: [
      { min: 0,    max: null,     rate: 0.056 },  // [CRA rate] / [VERIFY threshold]
      { min: null, max: null,     rate: 0.077 },  // [VERIFY]
      { min: null, max: null,     rate: 0.105 },  // [VERIFY]
      { min: null, max: null,     rate: 0.1229 }, // [VERIFY]
      { min: null, max: null,     rate: 0.147 },  // [VERIFY]
      { min: null, max: null,     rate: 0.168 },  // [VERIFY]
      { min: null, max: Infinity, rate: 0.205 },  // [VERIFY count & rate]
    ],
    bpa: 13216, // [CRA] TD1BC 2026
    bpaCreditRate: 0.056,
    _note: 'BC brackets NOT shippable until thresholds verified against BC gov page.',
  },

  /* QUEBEC — STUB. DO NOT auto-generate from the pattern above. Separate build. */
  QC: {
    name: 'Quebec',
    _status: 'DEFERRED — build separately.',
    _why: [
      'Quebec uses QPP (not CPP) at a higher rate — separate contribution math.',
      'Quebec has QPIP (parental insurance) on top of a reduced EI rate.',
      'Quebec residents receive a 16.5% federal abatement — federal tax is reduced.',
      'Quebec has its own brackets/BPA. CRA PDOC itself excludes Quebec.',
    ],
    // Do not ship a Quebec calculator until QPP/QPIP/abatement are modelled and verified
    // against Revenu Québec + CRA. A pattern-matched QC page will be wrong.
  },
};

/* ── PROVINCES STILL TO ADD (Phase 2) ────────────────────────────────────── */
// MB, SK, NS, NB, NL, PE, plus territories YT, NT, NU. Add each from its TD1/T4032
// page using the ON/AB shape. Keep one primary source URL comment per province.

/* ── SHIP GATE ───────────────────────────────────────────────────────────── */
// Which provinces the calculators are allowed to compute for in THIS build.
// BC and QC are present above for reference only and must render as "coming soon".
export const PROVINCE_STATUS = { ON: 'live', AB: 'live', BC: 'stub', QC: 'stub' };
export const LIVE_PROVINCES = ['ON', 'AB'];
export const PROVINCE_ORDER = ['ON', 'AB', 'BC', 'QC'];

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
