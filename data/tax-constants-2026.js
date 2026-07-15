/**
 * tax-constants-2026.js — THE SOURCE OF TRUTH for every income-tax / payroll constant
 * used across calc-hq.ca for the 2026 tax year.
 *
 * WHY THIS FILE EXISTS
 *   Every federal and provincial/territorial tax constant lives here exactly once, and
 *   each one carries its provenance: { value, source_url, last_verified }. `rates-2026.js`
 *   derives the flat runtime objects (FEDERAL / CPP / EI / PROVINCES) from this file, so
 *   the tax engine and every calculator keep consuming clean numbers — nothing else had
 *   to change. Update a number HERE and it flows everywhere.
 *
 * FORMAT — a JS module, not JSON, on purpose: bracket ceilings use `Infinity` (JSON can't
 *   represent it) and the calculators already import ES modules.
 *
 * PROVENANCE FIELDS
 *   value         — the number (or structure) the calculators use.
 *   source_url    — the primary government page it can be re-verified against.
 *   last_verified — ISO date it was last confirmed against source_url, OR the literal
 *                   "UNVERIFIED — pending Jan audit" when it has NOT been confirmed.
 *
 * MAINTENANCE — see MAINTENANCE.md. Two rules: (1) re-verify every value each January;
 *   (2) on a mid-year provincial tax change, verify against the ENACTED STATUTE, not the
 *   CRA T4032 table, which lags (PEI Bill No. 23 is the worked example).
 *
 * SCOPE — federal income tax + CPP/CPP2/EI, and per-jurisdiction income-tax brackets/BPAs
 *   (+ Ontario surtax/health premium, BC tax reduction, Yukon's federal-linked BPA & CEA).
 *   Quebec is intentionally absent: it is added tomorrow as the inaugural run of this
 *   system (QPP / QPIP / 16.5% abatement). Benefit-program constants (CCB, EI mat/parental,
 *   CPP-timing, LTT, ESA) still live in rates-2026.js and are NOT yet migrated here.
 */
export const TAX_YEAR = 2026;

/* Primary-source URLs (kept here so each constant can point at one without repetition). */
const T4032 = (xx) =>
  `https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4032-payroll-deductions-tables/t4032${xx}-jan/t4032${xx}-january-general-information.html`;
const SRC = {
  fed:       T4032('on'),        // CRA T4032 "Chart 1" (federal) appears on every T4032 page
  cpp:       'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html',
  qpp:       'https://www.retraitequebec.gouv.qc.ca/en/programs/quebec-pension-plan/quebec-pension-plan-figures',
  qpip:      'https://www.rqap.gouv.qc.ca/en/about-the-plan/general-information/premiums-and-maximum-insurable-earnings',
  qpipPlans: 'https://www.quebec.ca/en/family-and-support-for-individuals/pregnancy-parenthood/financial-support-pregnant-women-families/quebec-parental-insurance-plan/pregnancy-childbirth/choice-plan',
  ei:        'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html',
  eiBenefit: 'https://www.canada.ca/en/services/benefits/ei/ei-maternity-parental/benefit-amount.html',
  bcRates:   'https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates',
  bcCredits: 'https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/credits/basic',
  peGov:     'https://www.princeedwardisland.ca/en/information/finance/provincial-personal-income-tax',
  yukon:     'https://yukon.ca/en/yukon-historical-tax-rates',
};

export const TAX_CONSTANTS_2026 = {
  /* ── FEDERAL ──────────────────────────────────────────────────────────────── */
  federal: {
    brackets: {
      value: [
        { min: 0,      max: 58523,    rate: 0.14 },
        { min: 58523,  max: 117045,   rate: 0.205 },
        { min: 117045, max: 181440,   rate: 0.26 },
        { min: 181440, max: 258482,   rate: 0.29 },
        { min: 258482, max: Infinity, rate: 0.33 },
      ],
      source_url: SRC.fed, last_verified: '2026-07-13', // CRA T4032 Chart 1
    },
    // Basic Personal Amount — phases down for high earners (max → min across the band).
    bpa: {
      value: { max: 16452, min: 14829, phaseOutStart: 181440, phaseOutEnd: 258482, creditRate: 0.14 },
      source_url: SRC.fed, last_verified: '2026-07-13', // CRA T4032 "Basic personal amounts"
    },
    // Canada Employment Amount: credit maxes at $210.14 (= base × 14%); base is $1,501.
    canadaEmploymentAmountMaxCredit: { value: 210.14, source_url: SRC.fed, last_verified: '2026-07-13' },
    canadaEmploymentAmountBase:      { value: 1501,   source_url: SRC.fed, last_verified: '2026-07-13' },
  },

  /* ── CPP / CPP2 (all provinces except Quebec, which uses QPP) ──────────────── */
  cpp: {
    rate:                   { value: 0.0595,   source_url: SRC.cpp, last_verified: '2026-07-13' },
    basicExemption:         { value: 3500,     source_url: SRC.cpp, last_verified: '2026-07-13' },
    ympe:                   { value: 74600,    source_url: SRC.cpp, last_verified: '2026-07-13' }, // Year's Max Pensionable Earnings
    maxEmployeeContribution:{ value: 4230.45,  source_url: SRC.cpp, last_verified: '2026-07-13' },
    baseCpp1Rate:           { value: 0.0495,   source_url: SRC.cpp, last_verified: '2026-07-13' }, // credit-eligible portion
    enhancedCpp1Rate:       { value: 0.01,     source_url: SRC.cpp, last_verified: '2026-07-13' }, // income-deductible portion
    cpp2: {
      rate:            { value: 0.04,   source_url: SRC.cpp, last_verified: '2026-07-13' },
      yampe:           { value: 85000,  source_url: SRC.cpp, last_verified: '2026-07-13' }, // Year's Additional Max Pensionable Earnings
      maxContribution: { value: 416,    source_url: SRC.cpp, last_verified: '2026-07-13' },
    },
    // Structural CPP rule (not a rate-table value): the self-employed pay both halves.
    selfEmployedMultiplier: 2,
  },

  /* ── QPP (Québec Pension Plan) — REPLACES CPP for Quebec workers ───────────── */
  // QPP is separate from CPP and has its own schedule. The exemption ($3,500), MPE
  // ($74,600), YAMPE ($85,000) and the second-additional tier (4%) are IDENTICAL to CPP,
  // but the base rate DIVERGES: QPP base is 5.3% (vs CPP 4.95%), so QPP1 = 6.3% total (vs
  // CPP 5.95%) and the QPP1 employee max is $4,479.30 (vs CPP $4,230.45). Verified
  // 2026-07-15 against Retraite Québec "Québec Pension Plan Figures" (2026 table). The
  // page's rate column labels the second tier "2%", but its dollar amounts ($416 employee
  // / $832 self-employed on the $10,400 band) confirm 4% per side / 8% combined — same as
  // CPP2. Field names below mirror the CPP block so the engine treats the two plans
  // interchangeably (cpp2/enhancedCpp1Rate/baseCpp1Rate hold the QPP equivalents).
  qpp: {
    rate:                   { value: 0.063,   source_url: SRC.qpp, last_verified: '2026-07-15' }, // QPP1 total = base 5.3% + enhancement 1%
    basicExemption:         { value: 3500,    source_url: SRC.qpp, last_verified: '2026-07-15' },
    ympe:                   { value: 74600,   source_url: SRC.qpp, last_verified: '2026-07-15' },
    maxEmployeeContribution:{ value: 4479.30, source_url: SRC.qpp, last_verified: '2026-07-15' }, // 6.3% × ($74,600−$3,500)
    baseCpp1Rate:           { value: 0.053,   source_url: SRC.qpp, last_verified: '2026-07-15' }, // credit-eligible portion (QPP base plan)
    enhancedCpp1Rate:       { value: 0.01,    source_url: SRC.qpp, last_verified: '2026-07-15' }, // income-deductible portion (first additional)
    cpp2: {
      rate:            { value: 0.04,   source_url: SRC.qpp, last_verified: '2026-07-15' }, // second additional (per side)
      yampe:           { value: 85000,  source_url: SRC.qpp, last_verified: '2026-07-15' },
      maxContribution: { value: 416,    source_url: SRC.qpp, last_verified: '2026-07-15' },
    },
    selfEmployedMultiplier: 2,
  },

  /* ── EI (federal; Quebec pays a reduced rate + QPIP) ───────────────────────── */
  ei: {
    rate:                 { value: 0.0163,  source_url: SRC.ei, last_verified: '2026-07-14' },
    maxInsurableEarnings: { value: 68900,   source_url: SRC.ei, last_verified: '2026-07-14' },
    maxEmployeePremium:   { value: 1123.07, source_url: SRC.ei, last_verified: '2026-07-14' },
    employerRate:         { value: 0.0228,  source_url: SRC.ei, last_verified: '2026-07-14' }, // = employee rate × 1.4
    maxEmployerPremium:   { value: 1572.30, source_url: SRC.ei, last_verified: '2026-07-14' },
    benefitReplacementRate:{ value: 0.55,   source_url: SRC.eiBenefit, last_verified: '2026-07-14' }, // regular benefits = 55%
    quebec: {
      rate:               { value: 0.0130,  source_url: SRC.ei, last_verified: '2026-07-14' },
      maxEmployeePremium: { value: 895.70,  source_url: SRC.ei, last_verified: '2026-07-14' },
    },
  },

  /* ── QPIP (Québec Parental Insurance Plan) — REPLACES EI maternity/parental for QC ─ */
  // Quebec workers pay REDUCED federal EI (1.30% above — because QPIP covers parental)
  // PLUS a QPIP premium. QPIP has its own three contribution rates and its own (higher)
  // maximum insurable earnings, all separate from EI's. Rates cut 13% for 2026. Verified
  // 2026-07-15 against rqap.gouv.qc.ca "Premiums and maximum insurable earnings" (2026
  // column). Benefit weeks/percentages (Basic vs Special plan) are NOT here — they live
  // with the benefit calculators in rates-2026.js (QPIP_PARENTAL), like EI_PARENTAL.
  qpip: {
    employeeRate:          { value: 0.00430, source_url: SRC.qpip, last_verified: '2026-07-15' },
    employerRate:          { value: 0.00602, source_url: SRC.qpip, last_verified: '2026-07-15' },
    selfEmployedRate:      { value: 0.00764, source_url: SRC.qpip, last_verified: '2026-07-15' }, // single self-employed rate (unlike EI)
    maxInsurableEarnings:  { value: 103000,  source_url: SRC.qpip, last_verified: '2026-07-15' }, // QPIP MIE, separate from EI's $68,900
    maxEmployeePremium:    { value: 442.90,  source_url: SRC.qpip, last_verified: '2026-07-15' },
    maxEmployerPremium:    { value: 620.06,  source_url: SRC.qpip, last_verified: '2026-07-15' },
    maxSelfEmployedPremium:{ value: 786.92,  source_url: SRC.qpip, last_verified: '2026-07-15' },
  },

  /* ── PROVINCES & TERRITORIES (live jurisdictions only; Quebec added tomorrow) ─ */
  provinces: {
    ON: {
      name: 'Ontario', indexation: 0.019,
      brackets: { value: [
        { min: 0,      max: 53891,    rate: 0.0505 },
        { min: 53891,  max: 107785,   rate: 0.0915 },
        { min: 107785, max: 150000,   rate: 0.1116 },
        { min: 150000, max: 220000,   rate: 0.1216 },
        { min: 220000, max: Infinity, rate: 0.1316 },
      ], source_url: T4032('on'), last_verified: '2026-07-14' },
      bpa: { value: 12989, source_url: T4032('on'), last_verified: '2026-07-14' },
      bpaCreditRate: 0.0505,
      // Surtax on BASIC Ontario tax (after BPA credit): 20% over $5,818, +36% over $7,446.
      surtax: { value: [ { over: 5818, rate: 0.20 }, { over: 7446, rate: 0.36 } ],
                source_url: T4032('on'), last_verified: '2026-07-14' },
      // Ontario Health Premium — six flat bands, not indexed, tops out at $900.
      // NOTE: the engine currently HARDCODES this schedule (ontarioHealthPremium()); this
      // data array is the documented source of truth but is not yet read by the engine.
      // See MAINTENANCE.md / gap list — a known duplication to reconcile.
      healthPremium: { value: [
        { upTo: 20000,    premium: 0 },
        { upTo: 36000,    formula: 'lesser(300, 0.06*(income-20000))' },
        { upTo: 48000,    formula: 'lesser(450, 300+0.06*(income-36000))' },
        { upTo: 72000,    formula: 'lesser(600, 450+0.25*(income-48000))' },
        { upTo: 200000,   formula: 'lesser(750, 600+0.25*(income-72000))' },
        { upTo: Infinity, formula: 'lesser(900, 750+0.25*(income-200000))' },
      ], source_url: T4032('on'), last_verified: '2026-07-14' },
      healthPremiumMax: 900,
    },

    AB: {
      name: 'Alberta', indexation: 0.02,
      brackets: { value: [
        { min: 0,      max: 61200,    rate: 0.08 },
        { min: 61200,  max: 154259,   rate: 0.10 },
        { min: 154259, max: 185111,   rate: 0.12 },
        { min: 185111, max: 246813,   rate: 0.13 },
        { min: 246813, max: 370220,   rate: 0.14 },
        { min: 370220, max: Infinity, rate: 0.15 },
      ], source_url: T4032('ab'), last_verified: '2026-07-14' },
      bpa: { value: 22769, source_url: T4032('ab'), last_verified: '2026-07-14' },
      bpaCreditRate: 0.08,
    },

    BC: {
      name: 'British Columbia', indexation: 0.022,
      brackets: { value: [
        { min: 0,      max: 50363,    rate: 0.0560 },
        { min: 50363,  max: 100728,   rate: 0.0770 },
        { min: 100728, max: 115648,   rate: 0.1050 },
        { min: 115648, max: 140430,   rate: 0.1229 },
        { min: 140430, max: 190405,   rate: 0.1470 },
        { min: 190405, max: 265545,   rate: 0.1680 },
        { min: 265545, max: Infinity, rate: 0.2050 },
      ], source_url: SRC.bcRates, last_verified: '2026-07-13' },
      bpa: { value: 13216, source_url: SRC.bcCredits, last_verified: '2026-07-13' },
      bpaCreditRate: 0.056,
      // BC tax reduction credit — non-refundable low-income reduction (Budget 2026 raised
      // the base to $690). Reduces BC tax to a floor of zero; nil at $44,952.
      taxReduction: { value: { base: 690, threshold: 25570, rate: 0.0356 },
                      source_url: SRC.bcCredits, last_verified: '2026-07-13' },
    },

    SK: {
      name: 'Saskatchewan', indexation: 0.02,
      brackets: { value: [
        { min: 0,      max: 54532,    rate: 0.1050 },
        { min: 54532,  max: 155805,   rate: 0.1250 },
        { min: 155805, max: Infinity, rate: 0.1450 },
      ], source_url: T4032('sk'), last_verified: '2026-07-13' },
      bpa: { value: 20381, source_url: T4032('sk'), last_verified: '2026-07-13' }, // Saskatchewan Affordability Act + indexation
      bpaCreditRate: 0.105,
    },

    MB: {
      name: 'Manitoba', indexation: 0, // thresholds + BPA FROZEN for 2026
      brackets: { value: [
        { min: 0,      max: 47000,    rate: 0.1080 },
        { min: 47000,  max: 100000,   rate: 0.1275 },
        { min: 100000, max: Infinity, rate: 0.1740 },
      ], source_url: T4032('mb'), last_verified: '2026-07-13' },
      bpa: { value: 15780, source_url: T4032('mb'), last_verified: '2026-07-13' },
      bpaCreditRate: 0.108,
    },

    NS: {
      name: 'Nova Scotia', indexation: 0.021,
      brackets: { value: [
        { min: 0,      max: 30995,    rate: 0.0879 },
        { min: 30995,  max: 61991,    rate: 0.1495 },
        { min: 61991,  max: 97417,    rate: 0.1667 },
        { min: 97417,  max: 157124,   rate: 0.1750 },
        { min: 157124, max: Infinity, rate: 0.2100 },
      ], source_url: T4032('ns'), last_verified: '2026-07-13' },
      bpa: { value: 11932, source_url: T4032('ns'), last_verified: '2026-07-13' }, // income-testing removed in 2025 — now flat
      bpaCreditRate: 0.0879,
    },

    NB: {
      name: 'New Brunswick', indexation: 0.02,
      brackets: { value: [
        { min: 0,      max: 52333,    rate: 0.0940 },
        { min: 52333,  max: 104666,   rate: 0.1400 },
        { min: 104666, max: 193861,   rate: 0.1600 },
        { min: 193861, max: Infinity, rate: 0.1950 },
      ], source_url: T4032('nb'), last_verified: '2026-07-13' },
      bpa: { value: 13664, source_url: T4032('nb'), last_verified: '2026-07-13' },
      bpaCreditRate: 0.094,
    },

    NL: {
      name: 'Newfoundland and Labrador', indexation: 0.02,
      brackets: { value: [
        { min: 0,       max: 44678,     rate: 0.0870 },
        { min: 44678,   max: 89354,     rate: 0.1450 },
        { min: 89354,   max: 159528,    rate: 0.1580 },
        { min: 159528,  max: 223340,    rate: 0.1780 },
        { min: 223340,  max: 285319,    rate: 0.1980 },
        { min: 285319,  max: 570638,    rate: 0.2080 },
        { min: 570638,  max: 1141275,   rate: 0.2130 },
        { min: 1141275, max: Infinity,  rate: 0.2180 },
      ], source_url: T4032('nl'), last_verified: '2026-07-13' },
      bpa: { value: 11188, source_url: T4032('nl'), last_verified: '2026-07-13' },
      bpaCreditRate: 0.087,
    },

    PE: {
      name: 'Prince Edward Island', indexation: 0.018,
      // Brackets from the ENACTED PEI law (Bill No. 23, 2026 budget): sixth bracket over
      // $200,000 @ 20% and fifth threshold $142,520. CRA T4032-PE still shows the pre-
      // Bill-23 five-bracket table — the table lagged the statute. See MAINTENANCE.md.
      brackets: { value: [
        { min: 0,      max: 33928,    rate: 0.0950 },
        { min: 33928,  max: 65820,    rate: 0.1347 },
        { min: 65820,  max: 106890,   rate: 0.1660 },
        { min: 106890, max: 142520,   rate: 0.1762 },
        { min: 142520, max: 200000,   rate: 0.1900 },
        { min: 200000, max: Infinity, rate: 0.2000 },
      ], source_url: SRC.peGov, last_verified: '2026-07-13' },
      bpa: { value: 15000, source_url: SRC.peGov, last_verified: '2026-07-13' },
      bpaCreditRate: 0.095,
    },

    YT: {
      name: 'Yukon', indexation: 0.02,
      brackets: { value: [
        { min: 0,      max: 58523,    rate: 0.0640 },
        { min: 58523,  max: 117045,   rate: 0.0900 },
        { min: 117045, max: 181440,   rate: 0.1090 },
        { min: 181440, max: 500000,   rate: 0.1280 },
        { min: 500000, max: Infinity, rate: 0.1500 },
      ], source_url: T4032('yt'), last_verified: '2026-07-13' },
      // Yukon uses the FEDERAL income-tested BPA (max $16,452 / min $14,829).
      bpa: { value: 16452, source_url: T4032('yt'), last_verified: '2026-07-13' },
      bpaPhaseOut: { value: { max: 16452, min: 14829, phaseOutStart: 181440, phaseOutEnd: 258482 },
                     source_url: SRC.yukon, last_verified: '2026-07-13' },
      bpaCreditRate: 0.064,
      includesCanadaEmploymentAmount: true, // Yukon grants a territorial CEA credit
    },

    NT: {
      name: 'Northwest Territories', indexation: 0.02,
      brackets: { value: [
        { min: 0,      max: 53003,    rate: 0.0590 },
        { min: 53003,  max: 106009,   rate: 0.0860 },
        { min: 106009, max: 172346,   rate: 0.1220 },
        { min: 172346, max: Infinity, rate: 0.1405 },
      ], source_url: T4032('nt'), last_verified: '2026-07-13' },
      bpa: { value: 18198, source_url: T4032('nt'), last_verified: '2026-07-13' },
      bpaCreditRate: 0.059,
    },

    NU: {
      name: 'Nunavut', indexation: 0.02,
      brackets: { value: [
        { min: 0,      max: 55801,    rate: 0.0400 },
        { min: 55801,  max: 111602,   rate: 0.0700 },
        { min: 111602, max: 181439,   rate: 0.0900 },
        { min: 181439, max: Infinity, rate: 0.1150 },
      ], source_url: T4032('nu'), last_verified: '2026-07-13' },
      bpa: { value: 19659, source_url: T4032('nu'), last_verified: '2026-07-13' }, // highest BPA in Canada
      bpaCreditRate: 0.04,
    },
  },
};
