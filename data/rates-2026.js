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
 * SHIP STATUS FOR THIS BUILD: Ontario (ON), Alberta (AB) and British Columbia (BC)
 * are live. Quebec (QC) remains a stub — its QPP/QPIP/abatement math is not yet
 * modelled, so the calculators must NOT compute for it. See PROVINCE_STATUS /
 * LIVE_PROVINCES below.
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
  // [CRA] Canada Employment Amount — credit value maxes at $210.14 (= CEA base × 14%).
  // Base verified $1,501 from CRA T4032 (Rev.26): "the federal CEA is the lesser of
  // $1,501 and employment income". Yukon parallels this credit at its lowest rate.
  canadaEmploymentAmountMaxCredit: 210.14,
  canadaEmploymentAmountBase: 1501,
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

  /* BRITISH COLUMBIA — LIVE. All figures verified 2026-07-13 against gov.bc.ca:
     Brackets + rates: https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates
       (page "Last updated April 17, 2026", 2026 tax year table)
     BPA + BC tax reduction credit:
       https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/credits/basic
       (page "Last updated April 20, 2026")
     2026 brackets indexed +2.2% (BC CPI); Budget 2026 pauses indexation 2027–2030. */
  BC: {
    name: 'British Columbia',
    indexation: 0.022, // [BC] 2.2% for 2026 (paused 2027–2030 per Budget 2026)
    brackets: [
      { min: 0,      max: 50363,    rate: 0.0560 }, // [gov.bc.ca] lowest rate 5.06%→5.60% for 2026
      { min: 50363,  max: 100728,   rate: 0.0770 }, // [gov.bc.ca]
      { min: 100728, max: 115648,   rate: 0.1050 }, // [gov.bc.ca]
      { min: 115648, max: 140430,   rate: 0.1229 }, // [gov.bc.ca]
      { min: 140430, max: 190405,   rate: 0.1470 }, // [gov.bc.ca]
      { min: 190405, max: 265545,   rate: 0.1680 }, // [gov.bc.ca]
      { min: 265545, max: Infinity, rate: 0.2050 }, // [gov.bc.ca]
    ],
    bpa: 13216,          // [gov.bc.ca] BC basic personal amount 2026
    bpaCreditRate: 0.056, // credit valued at the lowest bracket rate
    surtax: [],          // BC has no surtax
    healthPremium: [],   // BC has no health premium (MSP premiums ended in 2020)
    // [gov.bc.ca] BC TAX REDUCTION CREDIT — the low-income reduction most calculators miss.
    // Non-refundable: reduces BC tax to a floor of zero, never below. Full base amount if
    // net income ≤ threshold; reduced by rate × (net income − threshold); nil at $44,952.
    // Budget 2026 raised the base from $575 to $690 for 2026–2030.
    taxReduction: { base: 690, threshold: 25570, rate: 0.0356 },
  },

  /* ── The following six provinces verified 2026-07-13 against CRA T4032 (Rev. 26,
       effective Jan 1 2026) general-information pages, one per province. Each has NO
       surtax and a FLAT basic personal amount (no income-testing). Their low-income
       tax reductions (NB/NL/PE) live on the provincial 428 returns, are absent from
       CRA payroll withholding, depend on FAMILY net income, and reduce to nil below
       ~$40k — so they are NOT modelled here (out of scope for a single-earner
       estimate; no effect at typical incomes). See handoff notes / commit message. */

  /* SASKATCHEWAN — [CRA T4032-SK Rev.26]. BPA raised by the Saskatchewan
     Affordability Act (+$500/yr for 4 years) on top of indexation. No surtax. */
  SK: {
    name: 'Saskatchewan',
    indexation: 0.02,
    brackets: [
      { min: 0,      max: 54532,    rate: 0.1050 },
      { min: 54532,  max: 155805,   rate: 0.1250 },
      { min: 155805, max: Infinity, rate: 0.1450 },
    ],
    bpa: 20381,
    bpaCreditRate: 0.105,
    surtax: [],
    healthPremium: [],
  },

  /* MANITOBA — [CRA T4032-MB Rev.26]. BPA and bracket thresholds are FROZEN
     (not indexed) for 2026 per provincial budget. Flat BPA, no surtax. */
  MB: {
    name: 'Manitoba',
    indexation: 0, // thresholds frozen for 2026
    brackets: [
      { min: 0,      max: 47000,    rate: 0.1080 },
      { min: 47000,  max: 100000,   rate: 0.1275 },
      { min: 100000, max: Infinity, rate: 0.1740 },
    ],
    bpa: 15780,
    bpaCreditRate: 0.108,
    surtax: [],
    healthPremium: [],
  },

  /* NOVA SCOTIA — [CRA T4032-NS Rev.26]. As of 2025 the BPA is set at the maximum
     for everyone (income-testing REMOVED); flat $11,932 for 2026. No surtax. */
  NS: {
    name: 'Nova Scotia',
    indexation: 0.021,
    brackets: [
      { min: 0,      max: 30995,    rate: 0.0879 },
      { min: 30995,  max: 61991,    rate: 0.1495 },
      { min: 61991,  max: 97417,    rate: 0.1667 },
      { min: 97417,  max: 157124,   rate: 0.1750 },
      { min: 157124, max: Infinity, rate: 0.2100 },
    ],
    bpa: 11932,
    bpaCreditRate: 0.0879,
    surtax: [],
    healthPremium: [],
  },

  /* NEW BRUNSWICK — [CRA T4032-NB Rev.26]. Flat BPA, no surtax. */
  NB: {
    name: 'New Brunswick',
    indexation: 0.02,
    brackets: [
      { min: 0,      max: 52333,    rate: 0.0940 },
      { min: 52333,  max: 104666,   rate: 0.1400 },
      { min: 104666, max: 193861,   rate: 0.1600 },
      { min: 193861, max: Infinity, rate: 0.1950 },
    ],
    bpa: 13664,
    bpaCreditRate: 0.094,
    surtax: [],
    healthPremium: [],
  },

  /* NEWFOUNDLAND AND LABRADOR — [CRA T4032-NL Rev.26]. Eight brackets. No surtax. */
  NL: {
    name: 'Newfoundland and Labrador',
    indexation: 0.02,
    brackets: [
      { min: 0,       max: 44678,     rate: 0.0870 },
      { min: 44678,   max: 89354,     rate: 0.1450 },
      { min: 89354,   max: 159528,    rate: 0.1580 },
      { min: 159528,  max: 223340,    rate: 0.1780 },
      { min: 223340,  max: 285319,    rate: 0.1980 },
      { min: 285319,  max: 570638,    rate: 0.2080 },
      { min: 570638,  max: 1141275,   rate: 0.2130 },
      { min: 1141275, max: Infinity,  rate: 0.2180 },
    ],
    bpa: 11188,
    bpaCreditRate: 0.087,
    surtax: [],
    healthPremium: [],
  },

  /* PRINCE EDWARD ISLAND — brackets from the PEI government site (princeedwardisland.ca,
     updated 2026-06-22), reflecting Bill No 23 (2026 budget) which added the sixth
     bracket (over $200,000 @ 20%) and set the fifth threshold at $142,520. CRA T4032-PE
     Rev.26 still shows the pre-Bill-23 five-bracket table (top $142,250+ @ 19%) — it
     predates the budget. Using the enacted PEI law. PEI's old surtax was REPLACED by
     the multi-bracket system (no surtax). Flat BPA $15,000. */
  PE: {
    name: 'Prince Edward Island',
    indexation: 0.018,
    brackets: [
      { min: 0,      max: 33928,    rate: 0.0950 },
      { min: 33928,  max: 65820,    rate: 0.1347 },
      { min: 65820,  max: 106890,   rate: 0.1660 },
      { min: 106890, max: 142520,   rate: 0.1762 },
      { min: 142520, max: 200000,   rate: 0.1900 },
      { min: 200000, max: Infinity, rate: 0.2000 },
    ],
    bpa: 15000,
    bpaCreditRate: 0.095,
    surtax: [],
    healthPremium: [],
  },

  /* ── TERRITORIES — verified 2026-07-13 against CRA T4032 (Rev. 26, Jan 1 2026),
       one territorial table each. Yukon additionally cross-checked against yukon.ca
       (rates + income-tested BPA match; no PEI-style lag). None has a surtax. */

  /* YUKON — [CRA T4032-YT Rev.26 + yukon.ca]. Two Yukon-specific features:
     (1) it uses the FEDERAL income-tested basic personal amount (max $16,452,
     min $14,829, phasing between $181,440 and $258,482 of net income); and
     (2) it grants a territorial Canada Employment Amount credit ($1,501 base at
     the lowest rate) — both modelled below. Top rate 15% starts at $500,000. */
  YT: {
    name: 'Yukon',
    indexation: 0.02,
    brackets: [
      { min: 0,      max: 58523,    rate: 0.0640 },
      { min: 58523,  max: 117045,   rate: 0.0900 },
      { min: 117045, max: 181440,   rate: 0.1090 },
      { min: 181440, max: 500000,   rate: 0.1280 },
      { min: 500000, max: Infinity, rate: 0.1500 },
    ],
    bpa: 16452, // reference (maximum); phase-out below governs the actual amount
    bpaPhaseOut: { max: 16452, min: 14829, phaseOutStart: 181440, phaseOutEnd: 258482 },
    bpaCreditRate: 0.064,
    includesCanadaEmploymentAmount: true,
    surtax: [],
    healthPremium: [],
  },

  /* NORTHWEST TERRITORIES — [CRA T4032-NT Rev.26]. Notably high flat BPA. No surtax. */
  NT: {
    name: 'Northwest Territories',
    indexation: 0.02,
    brackets: [
      { min: 0,      max: 53003,    rate: 0.0590 },
      { min: 53003,  max: 106009,   rate: 0.0860 },
      { min: 106009, max: 172346,   rate: 0.1220 },
      { min: 172346, max: Infinity, rate: 0.1405 },
    ],
    bpa: 18198,
    bpaCreditRate: 0.059,
    surtax: [],
    healthPremium: [],
  },

  /* NUNAVUT — [CRA T4032-NU Rev.26]. Highest BPA in Canada; lowest rates. No surtax. */
  NU: {
    name: 'Nunavut',
    indexation: 0.02,
    brackets: [
      { min: 0,      max: 55801,    rate: 0.0400 },
      { min: 55801,  max: 111602,   rate: 0.0700 },
      { min: 111602, max: 181439,   rate: 0.0900 },
      { min: 181439, max: Infinity, rate: 0.1150 },
    ],
    bpa: 19659,
    bpaCreditRate: 0.04,
    surtax: [],
    healthPremium: [],
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

/* ── STILL TO ADD ────────────────────────────────────────────────────────── */
// Quebec (QC) only — it needs QPP/QPIP/federal-abatement math, a separate build,
// and stays gated. Every other province and territory is now live.

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
export const CPP_RETIREMENT = {
  earlyReductionPerMonth: 0.006, // 0.6%/month for each month before 65
  earlyMaxReduction: 0.36,       // 36% at age 60 (60 months early)
  lateIncreasePerMonth: 0.007,   // 0.7%/month after 65 — reference only, not used on 60-vs-65
  lateMaxIncrease: 0.42,         // 42% at age 70 — reference only
  maxAt65Monthly: 1507.65,       // context only — do NOT prefill the input
  averageAt65Monthly: 877.01,    // context only

  // Monthly pension if started at `startAge` (60–65 for this page), given the
  // amount payable at 65. Reduction is 0.6% × months-before-65.
  monthlyAtStart(monthlyAt65, startAge) {
    const monthsEarly = Math.max(0, Math.min(60, (65 - startAge) * 12));
    return monthlyAt65 * (1 - this.earlyReductionPerMonth * monthsEarly);
  },

  // Break-even age for start-at-60 vs start-at-65, in years. The early starter
  // banks (monthlyAt60 × 60) by age 65; after 65 the later, larger pension closes
  // that lead at (monthlyAt65 − monthlyAt60) per month. Those catch-up months fall
  // AFTER 65, so the break-even age is 65 + months/12 (NOT 60 + …). Note this comes
  // out to ~73.9 regardless of the dollar amount — it's driven purely by the 36%
  // reduction, since both the lead and the catch-up scale with the pension size.
  breakEvenAge(monthlyAt65) {
    const at60 = this.monthlyAtStart(monthlyAt65, 60);
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
