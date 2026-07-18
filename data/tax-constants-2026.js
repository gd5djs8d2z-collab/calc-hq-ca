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
 *   cadence       — OPTIONAL. When the value is expected to change, so the staleness
 *                   checker knows when a stamp has gone stale. One of:
 *                     'january'   — annual CRA/payroll indexation (THE DEFAULT when the
 *                                   field is omitted; this is MAINTENANCE Rule 1).
 *                     'july'      — re-indexed each July on a July–June benefit year (CCB).
 *                     'quarterly' — re-indexed Jan/Apr/Jul/Oct (GIS/OAS, CPP averages).
 *                     'statutory' — changes ONLY by legislation or by-law, never by
 *                                   indexation. Never goes stale on a calendar; re-verify
 *                                   when the governing statute is amended (MAINTENANCE Rule 2).
 *                   A node inherits its block's `_cadence` when it has no cadence of its own.
 *
 * MAINTENANCE — see MAINTENANCE.md, five rules: (1) re-verify every value each January;
 *   (2) on a mid-year provincial tax change, verify against the ENACTED STATUTE, not the
 *   CRA T4032 table, which lags (PEI Bill No. 23 is the worked example); (3) GIS/OAS
 *   quarterly; (4) cadence tags + `scripts/check-constants.mjs`, which flags unstamped,
 *   unsourced and stale values — run it before any audit; (5) CCB each July.
 *
 * SCOPE — federal income tax + CPP/CPP2/EI, and per-jurisdiction income-tax brackets/BPAs
 *   (+ Ontario surtax/health premium, BC tax reduction, Yukon's federal-linked BPA & CEA).
 *   Quebec is fully wired: its own brackets/BPA (bundled credit base), QPP, QPIP, and the
 *   16.5% federal abatement. The benefit-program constants (ESA, CCB, LTT, CPP-timing,
 *   EI mat/parental, QPIP mat/parental) are ALSO here — every one of them stamped. The
 *   behaviour that consumes them (the `noticeWeeks`/`estimate`/`tax` methods) stays in
 *   rates-2026.js; this file holds data only, never logic.
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
  qcAbatement: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-44000-refundable-quebec-abatement.html',
  qcRates:   'https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/',
  qcBpa:     'https://www.revenuquebec.ca/en/businesses/source-deductions-and-employer-contributions/employers-principal-changes-for-2026/',
  qcWorkerDed: 'https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/how-to-complete-your-income-tax-return/line-by-line-help/201-to-260-net-income/line-201/',
  ei:        'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/employment-insurance-ei/ei-premium-rates-maximums.html',
  eiBenefit: 'https://www.canada.ca/en/services/benefits/ei/ei-maternity-parental/benefit-amount.html',
  bcRates:   'https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates',
  bcCredits: 'https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/credits/basic',
  peGov:     'https://www.princeedwardisland.ca/en/information/finance/provincial-personal-income-tax',
  yukon:     'https://yukon.ca/en/yukon-historical-tax-rates',
  nlFin:     'https://www.gov.nl.ca/fin/tax-programs-incentives/personal/personalincometax/',
  craLimits: 'https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html',
  fhsa:      'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account/contributing-your-fhsa.html',
  eduSavings:'https://www.canada.ca/en/services/benefits/education/education-savings/estimating-amounts.html',
  craFiling: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals/filing-dates-tax-return.html',
  craRrspDates: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/important-dates-rrsp-rrif-rdsp.html',
  craInstalments: 'https://www.canada.ca/en/revenue-agency/services/payments/payments-cra/individual-payments/income-tax-instalments/due-dates.html',
  gis:       'https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/guaranteed-income-supplement/benefit-amount.html',
  gisEligibility: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/guaranteed-income-supplement/eligibility.html',
  oasPayments: 'https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/payments.html',
  craBenefitDates: 'https://www.canada.ca/en/revenue-agency/services/child-family-benefits/benefit-payment-dates.html',
  // The whole-of-government benefits calendar — the one page carrying BOTH the Service
  // Canada pension dates (CPP / OAS / GIS) and the CRA benefit dates in a single place.
  benefitsCalendar: 'https://www.canada.ca/en/services/benefits/calendar.html',
  // ── Benefit-program sources (migrated out of rates-2026.js 2026-07-18) ──
  esaTermination: 'https://www.ontario.ca/document/your-guide-employment-standards-act-0/termination-employment',
  esaSeverance:   'https://www.ontario.ca/document/your-guide-employment-standards-act-0/severance-pay',
  esaOvertime:    'https://www.ontario.ca/document/your-guide-employment-standards-act-0/overtime-pay',
  esaVacation:    'https://www.ontario.ca/document/your-guide-employment-standards-act-0/vacation',
  ccbHowMuch:     'https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit/how-much.html',
  ccbSheets:      'https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit/canada-child-benefit-calculation-sheets.html',
  // CRA indexation chart — the ONLY canada.ca page that publishes the CCB base maxima and
  // phase-out amounts for the CURRENT benefit year. The calculation-sheet page lags a full
  // year and the CCB "how much" page no longer states the maxima at all.
  craIndexation:  'https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/adjustment-personal-income-tax-benefit-amounts.html',
  lttOntario:     'https://www.ontario.ca/document/land-transfer-tax/calculating-land-transfer-tax',
  lttOntarioFtb:  'https://www.ontario.ca/document/land-transfer-tax/land-transfer-tax-refunds-first-time-homebuyers',
  lttToronto:     'https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/municipal-land-transfer-tax-mltt-rates-and-fees/',
  lttTorontoBylaw:'https://secure.toronto.ca/council/agenda-item.do?item=2025.EX28.1',
  cppWhenStart:   'https://www.canada.ca/en/services/benefits/publicpensions/cpp/cpp-benefit/when-start.html',
  cppAmount:      'https://www.canada.ca/en/services/benefits/publicpensions/cpp/cpp-benefit/amount.html',
  qppCalculation: 'https://www.retraitequebec.gouv.qc.ca/en/citizens/retirement-planning/applying-your-retirement-pension/retirement-pension-quebec-pension-plan/calculation-your-retirement-pension',
  qppFigures:     'https://www.retraitequebec.gouv.qc.ca/en/benefits-amounts-key-data',
  eiMatParental:  'https://www.canada.ca/en/services/benefits/ei/ei-maternity-parental.html',
  eiAfterApply:   'https://www.canada.ca/en/services/benefits/ei/ei-maternity-parental/after-applying.html',
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
    rate:                   { value: 0.0595,   source_url: SRC.cpp, last_verified: '2026-07-18' },
    basicExemption:         { value: 3500,     source_url: SRC.cpp, last_verified: '2026-07-18' },
    ympe:                   { value: 74600,    source_url: SRC.cpp, last_verified: '2026-07-18' }, // Year's Max Pensionable Earnings
    maxEmployeeContribution:{ value: 4230.45,  source_url: SRC.cpp, last_verified: '2026-07-18' },
    baseCpp1Rate:           { value: 0.0495,   source_url: SRC.cpp, last_verified: '2026-07-13' }, // credit-eligible portion
    enhancedCpp1Rate:       { value: 0.01,     source_url: SRC.cpp, last_verified: '2026-07-13' }, // income-deductible portion
    cpp2: {
      rate:            { value: 0.04,   source_url: SRC.cpp, last_verified: '2026-07-13' },
      yampe:           { value: 85000,  source_url: SRC.cpp, last_verified: '2026-07-13' }, // Year's Additional Max Pensionable Earnings
      maxContribution: { value: 416,    source_url: SRC.cpp, last_verified: '2026-07-13' },
    },
    // The self-employed pay both halves. Confirmed 2026-07-18 on the CRA rate table: the
    // 2026 "maximum annual self-employed contribution" ($8,460.90) is exactly twice the
    // "maximum annual employee and employer contribution" ($4,230.45).
    selfEmployedMultiplier: { value: 2, source_url: SRC.cpp, last_verified: '2026-07-18', cadence: 'statutory' },
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
    // Confirmed 2026-07-18 on the Retraite Québec figures page: "Self-employed workers pay
    // both shares of the contribution, that is, the employer's share and the worker's
    // share" — and numerically, the self-employed base contribution ($7,536 at 10.6%) is
    // exactly twice the worker's ($3,768 at 5.3%).
    selfEmployedMultiplier: { value: 2, source_url: SRC.qpp, last_verified: '2026-07-18', cadence: 'statutory' },
  },

  /* ── EI (federal; Quebec pays a reduced rate + QPIP) ───────────────────────── */
  ei: {
    rate:                 { value: 0.0163,  source_url: SRC.ei, last_verified: '2026-07-18' },
    maxInsurableEarnings: { value: 68900,   source_url: SRC.ei, last_verified: '2026-07-18' },
    maxEmployeePremium:   { value: 1123.07, source_url: SRC.ei, last_verified: '2026-07-18' },
    employerRate:         { value: 0.0228,  source_url: SRC.ei, last_verified: '2026-07-14' }, // = employee rate × 1.4
    maxEmployerPremium:   { value: 1572.30, source_url: SRC.ei, last_verified: '2026-07-18' },
    benefitReplacementRate:{ value: 0.55,   source_url: SRC.eiBenefit, last_verified: '2026-07-14' }, // regular benefits = 55%
    quebec: {
      rate:               { value: 0.0130,  source_url: SRC.ei, last_verified: '2026-07-18' },
      maxEmployeePremium: { value: 895.70,  source_url: SRC.ei, last_verified: '2026-07-18' },
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

  /* ── QUEBEC — federal-side adjustments ──────────────────────────────────── */
  // Refundable Quebec abatement: Quebec residents reduce BASIC federal tax (T1 line
  // 42900) by 16.5% (T1 line 44000 = line 42900 × 16.5%). The 16.5 points = 13.5
  // (Alternative Payments for Standing Programs) + 3 (Youth Allowances Recovery);
  // stable for decades. Rate + base are direct CRA quotes, no interpretation.
  quebec: {
    federalAbatementRate:  { value: 0.165,   source_url: SRC.qcAbatement, last_verified: '2026-07-15' },
  },

  /* ── PROVINCES & TERRITORIES (all 13 live; Quebec runs its own tax system) ──── */
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
      // Non-refundable credits are valued at the LOWEST provincial rate (CRA T4032,
      // "Multiply the total on line 17 by the lowest provincial tax rate"), so this is
      // brackets[0].rate by definition — check-constants.mjs enforces that invariant.
      bpaCreditRate: { value: 0.0505, source_url: T4032('on'), last_verified: '2026-07-14' },
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
      // Top band cap, confirmed 2026-07-18 on T4032-ON: "when taxable income is greater
      // than $200,000, the premium is the lesser of (i) $900 and (ii) $750 plus 25%..."
      healthPremiumMax: { value: 900, source_url: T4032('on'), last_verified: '2026-07-18' },
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
      bpaCreditRate: { value: 0.08, source_url: T4032('ab'), last_verified: '2026-07-14' }, // = brackets[0].rate (lowest-rate rule)
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
      bpaCreditRate: { value: 0.056, source_url: SRC.bcRates, last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
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
      bpaCreditRate: { value: 0.105, source_url: T4032('sk'), last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
    },

    MB: {
      name: 'Manitoba', indexation: 0, // thresholds + BPA FROZEN for 2026
      brackets: { value: [
        { min: 0,      max: 47000,    rate: 0.1080 },
        { min: 47000,  max: 100000,   rate: 0.1275 },
        { min: 100000, max: Infinity, rate: 0.1740 },
      ], source_url: T4032('mb'), last_verified: '2026-07-13' },
      bpa: { value: 15780, source_url: T4032('mb'), last_verified: '2026-07-13' },
      bpaCreditRate: { value: 0.108, source_url: T4032('mb'), last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
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
      bpaCreditRate: { value: 0.0879, source_url: T4032('ns'), last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
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
      bpaCreditRate: { value: 0.094, source_url: T4032('nb'), last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
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
      ], source_url: SRC.nlFin, last_verified: '2026-07-15' },
      // AUDIT 2026-07-15: was $11,188 (the 2025 value — stale). NL Budget 2026 (Apr 29)
      // raised the BPA to $13,094 effective Jan 1, 2026. This is the 2026 return / non-
      // refundable-credit-table amount (gov.nl.ca/fin). NL is separately phasing toward a
      // $15,000 exemption, delivered in-year via a prorated higher payroll BPA from July —
      // but the amount claimed on the 2026 return is $13,094, which is what an annual calc uses.
      bpa: { value: 13094, source_url: SRC.nlFin, last_verified: '2026-07-15' },
      bpaCreditRate: { value: 0.087, source_url: SRC.nlFin, last_verified: '2026-07-15' }, // = brackets[0].rate (lowest-rate rule)
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
      bpaCreditRate: { value: 0.095, source_url: SRC.peGov, last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
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
      bpaCreditRate: { value: 0.064, source_url: T4032('yt'), last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
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
      bpaCreditRate: { value: 0.059, source_url: T4032('nt'), last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
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
      bpaCreditRate: { value: 0.04, source_url: T4032('nu'), last_verified: '2026-07-13' }, // = brackets[0].rate (lowest-rate rule)
    },

    // QUEBEC — its own tax system (not the CRA collection agreement). Brackets + BPA
    // from Revenu Québec, indexed 2.05% for 2026. NOTE: Quebec's basic amount is a
    // BUNDLED credit base — per Revenu Québec (Line 350) it "takes into account"
    // QPP, the health services fund, QPIP and EI, so the engine must NOT add the
    // QPP/EI credits on top the way it does for other provinces (bpaBundlesContributions).
    // The deduction for workers (TP-1 line 201) IS modelled — see workerDeduction below.
    // Still out of scope: every other non-refundable credit beyond the basic amount
    // (age, living-alone, dependants, etc.).
    QC: {
      name: 'Quebec', indexation: 0.0205,
      brackets: { value: [
        { min: 0,      max: 54345,    rate: 0.14 },
        { min: 54345,  max: 108680,   rate: 0.19 },
        { min: 108680, max: 132245,   rate: 0.24 },
        { min: 132245, max: Infinity, rate: 0.2575 },
      ], source_url: SRC.qcRates, last_verified: '2026-07-15' },
      bpa: { value: 18952, source_url: SRC.qcBpa, last_verified: '2026-07-15' },
      bpaCreditRate: { value: 0.14, source_url: SRC.qcRates, last_verified: '2026-07-15' }, // = brackets[0].rate (Quebec's own conversion rate)
      bpaBundlesContributions: true, // basic amount already embeds QPP/QPIP/EI — don't re-add
      // Deduction for workers (TP-1 line 201): 6% of eligible work income (employment +
      // net business income, Work Chart 201), capped at $1,450 for 2026. A Quebec-only
      // DEDUCTION from net income — it reduces the QC taxable base before bracket tax and
      // does NOT affect federal tax. (Return page still shows the 2025 cap $1,420; the
      // 2026 $1,450 is from Revenu Québec's Principal Changes for 2026, same lag as the BPA.)
      workerDeduction: { value: { rate: 0.06, max: 1450 }, source_url: SRC.qcWorkerDed, last_verified: '2026-07-16' },
    },
  },

  /* ── REGISTERED-ACCOUNT LIMITS (2026) — for the Key Dates & Limits reference ──── */
  // TFSA / RRSP / YMPE / YAMPE all confirmed on the CRA MP-RRSP-DPSP-TFSA limits table
  // (SRC.craLimits, page updated 2025-12-01). FHSA is legislated (flat, not indexed).
  // RESP has no annual cap; the CESG figures are the education-savings estimating page.
  registeredAccounts: {
    tfsaAnnualLimit:           { value: 7000,   source_url: SRC.craLimits,  last_verified: '2026-07-16' }, // unchanged since 2024
    tfsaCumulativeSince2009:   { value: 109000, source_url: SRC.craLimits,  last_verified: '2026-07-16' }, // full room, eligible since 2009
    rrspDollarLimit:           { value: 33810,  source_url: SRC.craLimits,  last_verified: '2026-07-16' }, // 2026 (was $32,490 in 2025)
    rrspEarnedIncomePct:       { value: 0.18,   source_url: SRC.craLimits,  last_verified: '2026-07-16' }, // lesser of 18% of prior-year earned income or the dollar limit
    fhsaAnnualLimit:           { value: 8000,   source_url: SRC.fhsa,       last_verified: '2026-07-16' }, // legislated, not indexed
    fhsaLifetimeLimit:         { value: 40000,  source_url: SRC.fhsa,       last_verified: '2026-07-16' },
    respLifetimeLimit:         { value: 50000,  source_url: SRC.eduSavings, last_verified: '2026-07-18' }, // per beneficiary; no annual cap
    cesgRate:                  { value: 0.20,   source_url: SRC.eduSavings, last_verified: '2026-07-18' }, // basic grant = 20% of contributions
    cesgMaxPerYear:            { value: 500,    source_url: SRC.eduSavings, last_verified: '2026-07-18' }, // 20% of the first $2,500 contributed
    cesgFullGrantContribution: { value: 2500,   source_url: SRC.eduSavings, last_verified: '2026-07-18' },
    cesgLifetimeMax:           { value: 7200,   source_url: SRC.eduSavings, last_verified: '2026-07-18' }, // per child
  },

  /* ── 2026 TAX DEADLINES (for filing the 2025 return) ──────────────────────── */
  // Dates confirmed on the CRA "Filing due dates for the 2025 tax return" page (updated
  // 2026-01-20) + the RRSP and instalment due-date pages. CRA rule: a due date on a
  // weekend/holiday is met on the next business day — already applied where it shifts:
  // RRSP (Mar 1 is a Sunday -> Mar 2) and instalment 1 (Mar 15 is a Sunday -> Mar 16).
  taxDeadlines2026: {
    personalFiling:     { value: '2026-04-30', source_url: SRC.craFiling,      last_verified: '2026-07-16' },
    payment:            { value: '2026-04-30', source_url: SRC.craFiling,      last_verified: '2026-07-16' }, // balance owing (all individuals, incl. self-employed)
    selfEmployedFiling: { value: '2026-06-15', source_url: SRC.craFiling,      last_verified: '2026-07-16' },
    rrspContribution:   { value: '2026-03-02', source_url: SRC.craRrspDates,   last_verified: '2026-07-16' }, // for the 2025 tax year
    instalments:        { value: ['2026-03-16', '2026-06-15', '2026-09-15', '2026-12-15'],
                          source_url: SRC.craInstalments, last_verified: '2026-07-16' },
  },

  /* ── GUARANTEED INCOME SUPPLEMENT (GIS) — indexed QUARTERLY, NOT January ─────── */
  // Maximum monthly amounts + annual income cut-offs by marital/cohabitation status,
  // effective JULY–SEPTEMBER 2026 (Service Canada, confirmed live 2026-07-16 against the
  // benefit-amount page). IMPORTANT: Service Canada has RETIRED the detailed per-income GIS
  // rate tables in favour of its online estimator, so only the maxima and the cut-offs are
  // published. The calculator models a LINEAR phase-out from the max (at $0 income) to $0
  // (at the cut-off) — exact at both verified endpoints; the true curve is piecewise (base
  // reduces $1 per $2, with a steeper top-up band at low income). Re-index EVERY QUARTER
  // (Jan/Apr/Jul/Oct) — see MAINTENANCE.md. GIS never decreases quarter-to-quarter.
  gis: {
    _cadence: 'quarterly',
    effectiveQuarter:    { value: 'July–September 2026', source_url: SRC.gis, last_verified: '2026-07-16' },
    oasEligibilityAge:   { value: 65, source_url: SRC.gisEligibility, last_verified: '2026-07-16', cadence: 'statutory' },
    // maxMonthly = maximum monthly GIS; incomeCutoff = annual income (couples: combined) at/above which GIS is $0.
    single:          { value: { maxMonthly: 1123.17, incomeCutoff: 22800 }, source_url: SRC.gis, last_verified: '2026-07-16' }, // single / widowed / divorced
    spouseFullOAS:   { value: { maxMonthly: 676.09,  incomeCutoff: 30096 }, source_url: SRC.gis, last_verified: '2026-07-16' }, // spouse receives full OAS
    spouseAllowance: { value: { maxMonthly: 676.09,  incomeCutoff: 42144 }, source_url: SRC.gis, last_verified: '2026-07-16' }, // spouse receives the Allowance
    spouseNoOAS:     { value: { maxMonthly: 1123.17, incomeCutoff: 54624 }, source_url: SRC.gis, last_verified: '2026-07-16' }, // spouse does NOT receive OAS/Allowance
    // Employment / net self-employment exemption: first $5,000 fully exempt, then 50% of the
    // next $10,000 (max $10,000 exempt), PER PERSON. OAS and GIS themselves are excluded income.
    employmentExemption: { value: { full: 5000, partialUpTo: 10000, partialRate: 0.5 }, source_url: SRC.oasPayments, last_verified: '2026-07-16' },
  },

  /* ── BENEFIT PAYMENT DATES (2026) — CRA monthly payment calendars ─────────── */
  // All four calendars confirmed live 2026-07-18 against the CRA "Payment dates for CRA
  // administered benefits and credits" page (page date-modified 2026-07-09).
  // NOTE: the GST/HST credit was RENAMED partway through 2026 — CRA lists Jan/Apr under
  // "GST/HST credit" and Jul/Oct under "Canada Groceries and Essentials Benefit (formerly
  // the GST/HST credit)". Both are kept separate below so the page can explain the change.
  // These re-issue every year: re-verify the whole block each January (see MAINTENANCE.md).
  benefitPaymentDates2026: {
    _cadence: 'january', // the whole calendar re-issues each year
    ccb: { value: ['2026-01-20','2026-02-20','2026-03-20','2026-04-20','2026-05-20','2026-06-19',
                   '2026-07-20','2026-08-20','2026-09-18','2026-10-20','2026-11-20','2026-12-11'],
           source_url: SRC.craBenefitDates, last_verified: '2026-07-18' },
    gstCredit: { value: ['2026-01-05','2026-04-02'],
           source_url: SRC.craBenefitDates, last_verified: '2026-07-18' }, // old name, first half of 2026
    groceriesEssentials: { value: ['2026-07-03','2026-10-05'],
           source_url: SRC.craBenefitDates, last_verified: '2026-07-18' }, // renamed program, from July 2026
    ontarioTrillium: { value: ['2026-01-09','2026-02-10','2026-03-10','2026-04-10','2026-05-08','2026-06-10',
                   '2026-07-10','2026-08-10','2026-09-10','2026-10-09','2026-11-10','2026-12-10'],
           source_url: SRC.craBenefitDates, last_verified: '2026-07-18' }, // paid as "Canada PRO" on bank statements

    // ── Service Canada pensions: CPP, OAS, GIS ────────────────────────────────
    // ONE schedule covers all three. Confirmed 2026-07-18 on the whole-of-government
    // benefits calendar (page date-modified 2026-06-12), where:
    //   - the "Canada Pension Plan" and "Old Age Security" 2026 lists are IDENTICAL, and
    //     Service Canada publishes them as a single "2026 CPP and OAS printable version" PDF;
    //   - the Old Age Security entry states it "Includes Old Age Security pension (OAS),
    //     Guaranteed Income Supplement (GIS), allowance and allowance for the Survivor" —
    //     so GIS is paid on the OAS dates and has no separate calendar.
    // The CPP list likewise covers the retirement pension plus disability, children's and
    // survivor benefits.
    // Deliberately stored ONCE rather than as three identical copies that could drift.
    // IF SERVICE CANADA EVER PUBLISHES DIFFERENT CPP AND OAS DATES, split this into
    // separate `cpp` and `oasGis` nodes at that point — do not edit one set of dates and
    // assume the other followed.
    cppOasGis: { value: ['2026-01-28','2026-02-25','2026-03-27','2026-04-28','2026-05-27','2026-06-26',
                   '2026-07-29','2026-08-27','2026-09-25','2026-10-28','2026-11-26','2026-12-22'],
           source_url: SRC.benefitsCalendar, last_verified: '2026-07-18' },
  },

  /* ══════════════════════════════════════════════════════════════════════════
     BENEFIT-PROGRAM CONSTANTS — migrated out of rates-2026.js on 2026-07-18.
     Source URLs and verified dates below are carried over unchanged from the
     inline comments they replace; nothing was re-verified in the move. The
     methods that consume these (noticeWeeks, estimate, tax, …) stay in
     rates-2026.js — this file holds data only.
     ══════════════════════════════════════════════════════════════════════════ */

  /* ── ONTARIO EMPLOYMENT STANDARDS ACT ─────────────────────────────────────── */
  // Statutory minimums only — NOT common-law reasonable notice. Every value here
  // changes only when the ESA is amended, so the whole block is 'statutory': it
  // never goes stale on a calendar, but must be re-checked on any ESA amendment.
  ontarioEsa: {
    _cadence: 'statutory',
    // s.57 notice ladder. Verified 2026-07-12. Official ladder (3+ months employed):
    //   <3 mo = 0 wk · 3 mo–<1 yr = 1 wk · 1–<3 yr = 2 wk · then 1 wk per completed
    //   year to a cap of 8 weeks at 8 years or more.
    noticeLadder:   { value: [{ underMonths: 3, weeks: 0 }, { underMonths: 12, weeks: 1 }, { underMonths: 36, weeks: 2 }],
                      source_url: SRC.esaTermination, last_verified: '2026-07-12' },
    noticeCapWeeks: { value: 8, source_url: SRC.esaTermination, last_verified: '2026-07-12' },

    // s.64 statutory SEVERANCE PAY — a SEPARATE entitlement from notice above.
    // Verified 2026-07-12. Qualifies at 5+ years of employment AND either (a) global
    // payroll of $2.5M+, or (b) 50+ employees severed in 6 months on a permanent
    // closure. Amount = weekly wages × (completed years + completed months ÷ 12), max 26 wk.
    severanceMinYearsService:      { value: 5,       source_url: SRC.esaSeverance, last_verified: '2026-07-12' },
    severancePayrollThreshold:     { value: 2500000, source_url: SRC.esaSeverance, last_verified: '2026-07-12' }, // $2.5M global payroll
    severanceMassTerminationCount: { value: 50,      source_url: SRC.esaSeverance, last_verified: '2026-07-12' },
    severanceMassTerminationMonths:{ value: 6,       source_url: SRC.esaSeverance, last_verified: '2026-07-12' },
    severanceMaxWeeks:             { value: 26,      source_url: SRC.esaSeverance, last_verified: '2026-07-12' },

    // s.22 OVERTIME — 1½× the regular rate over 44 hours in a work WEEK (weekly basis;
    // no daily overtime unless a contract says so). Verified 2026-07-17. Managers and
    // many occupations are exempt or have a different threshold — NOT modelled.
    overtimeThresholdHours: { value: 44,  source_url: SRC.esaOvertime, last_verified: '2026-07-17' },
    overtimeMultiplier:     { value: 1.5, source_url: SRC.esaOvertime, last_verified: '2026-07-17' },

    // s.35.2 VACATION — at least 4% of gross wages under 5 years of employment, 6% at
    // 5+; vacation TIME is 2 weeks (<5 yr) / 3 weeks (5+ yr). Gross wages exclude
    // vacation pay itself. Verified 2026-07-17.
    vacationYearsCutoff: { value: 5,    source_url: SRC.esaVacation, last_verified: '2026-07-17' },
    vacationRateUnder5:  { value: 0.04, source_url: SRC.esaVacation, last_verified: '2026-07-17' },
    vacationRate5Plus:   { value: 0.06, source_url: SRC.esaVacation, last_verified: '2026-07-17' },
    vacationWeeksUnder5: { value: 2,    source_url: SRC.esaVacation, last_verified: '2026-07-17' },
    vacationWeeks5Plus:  { value: 3,    source_url: SRC.esaVacation, last_verified: '2026-07-17' },
  },

  /* ── CANADA CHILD BENEFIT (CCB) ───────────────────────────────────────────── */
  // ┌───────────────────────────────────────────────────────────────────────────┐
  // │ INDEXED EVERY JULY — NOT January. Runs on a July–June benefit year, so the  │
  // │ block cadence is 'july'. These figures are the July 2026 → June 2027 year,  │
  // │ based on 2025 adjusted family net income (AFNI). When CRA publishes the next │
  // │ calculation sheet, replace the maxima and thresholds below. The reduction    │
  // │ PERCENTAGES do not index — they've been fixed since 2016, so they are        │
  // │ marked 'statutory' individually and are exempt from the July staleness check.│
  // └───────────────────────────────────────────────────────────────────────────┘
  // CRA method: total base benefit minus a two-tier reduction. Tier 1 applies to AFNI
  // between the two thresholds; tier 2 applies above the second threshold on top of the
  // full tier-1 reduction accumulated across the band. The "fixed" dollar amounts CRA
  // prints for tier 2 are exactly (threshold2 − threshold1) × tier1Rate, so rates-2026.js
  // derives them rather than hardcoding — this stays correct after a threshold update.
  ccb: {
    _cadence: 'july',
    benefitYear: { value: 'July 2026 – June 2027', source_url: SRC.ccbHowMuch, last_verified: '2026-07-18' },
    baseYear:    { value: 2025,                    source_url: SRC.ccbHowMuch, last_verified: '2026-07-18' },
    // CONFIRMED PUBLISHED 2026-07-18 against the CRA indexation chart, "Canada child
    // benefit (CCB)" table, 2026 column — NOT derived. (These were previously flagged [3P]
    // as 2025–26 sheet values indexed +2.0%; that derivation turned out to land exactly on
    // CRA's published 2026 figure, and the flag is now cleared.)
    maxUnder6:  { value: 8157,  source_url: SRC.craIndexation, last_verified: '2026-07-18' }, // "CCB (base benefit, child under age 6)"
    max6to17:   { value: 6883,  source_url: SRC.craIndexation, last_verified: '2026-07-18' }, // "CCB (base benefit, child aged 6 to 17)"
    threshold1: { value: 38237, source_url: SRC.craIndexation, last_verified: '2026-07-18' }, // "Adjusted family net income at which phase out begins" (also on ccbHowMuch)
    threshold2: { value: 82847, source_url: SRC.craIndexation, last_verified: '2026-07-18' }, // "Second phase out threshold" (also on ccbHowMuch)
    // Reduction rates by number of eligible children (index 0 = 1 child … 3 = 4+).
    // Fixed since 2016 — these do NOT index, hence 'statutory'.
    // CROSS-CHECKED 2026-07-18: the indexation chart's "Base phase out amount" rows equal
    // (threshold2 − threshold1) × tier1Rate for all four family sizes — $3,123 / $6,022 /
    // $8,476 / $10,260 — confirming both these rates and the decision to derive those
    // dollar amounts rather than hardcode them.
    tier1Rates: { value: [0.07, 0.135, 0.19, 0.23],   source_url: SRC.craIndexation, last_verified: '2026-07-18', cadence: 'statutory' }, // AFNI between threshold1 and threshold2
    tier2Rates: { value: [0.032, 0.057, 0.08, 0.095], source_url: SRC.ccbSheets,     last_verified: '2026-07-12', cadence: 'statutory' }, // AFNI above threshold2 — from the calculation sheet; not on the indexation chart
  },

  /* ── LAND TRANSFER TAX (LTT) — Ontario provincial + Toronto municipal ─────── */
  // Marginal brackets: each rate applies only to the portion of the price within that
  // band. Applies to residential property with one or two single-family residences —
  // the case for essentially every home buyer (the top provincial rate and Toronto's
  // high-value rates are limited to 1–2 SFR properties).
  // NOT CRA-indexed: statutory rates set by the Province and the City of Toronto, changed
  // only by legislation/by-law — so the block is 'statutory', never stale on a calendar.
  // Verified 2026-07-13 against official sources only (no blogs/aggregators). Ontario max
  // first-time-buyer refund $4,000 clears the provincial LTT to ~$368,000; Toronto's
  // $4,475 clears the municipal LTT to $400,000. Toronto's graduated high-value rates for
  // 1–2 SFR took effect APRIL 1, 2026 (City Council 2025.EX28.1, By-law 132-2026).
  ltt: {
    _cadence: 'statutory',
    ontarioBrackets: { value: [
        { upTo: 55000,    rate: 0.005 },
        { upTo: 250000,   rate: 0.010 },
        { upTo: 400000,   rate: 0.015 },
        { upTo: 2000000,  rate: 0.020 },
        { upTo: Infinity, rate: 0.025 }, // over $2M, property with 1–2 SFR
      ], source_url: SRC.lttOntario, last_verified: '2026-07-13' },
    torontoBrackets: { value: [
        { upTo: 55000,    rate: 0.005 },
        { upTo: 250000,   rate: 0.010 },
        { upTo: 400000,   rate: 0.015 },
        { upTo: 2000000,  rate: 0.020 },
        { upTo: 3000000,  rate: 0.025 },
        { upTo: 4000000,  rate: 0.044 },
        { upTo: 5000000,  rate: 0.0545 },
        { upTo: 10000000, rate: 0.065 },
        { upTo: 20000000, rate: 0.0755 },
        { upTo: Infinity, rate: 0.086 },
      ], source_url: SRC.lttToronto, last_verified: '2026-07-13' },
    ontarioFtbRebateMax:  { value: 4000,   source_url: SRC.lttOntarioFtb,   last_verified: '2026-07-13' },
    torontoFtbRebateMax:  { value: 4475,   source_url: SRC.lttToronto,      last_verified: '2026-07-13' },
    torontoRatesEffective:{ value: 'April 1, 2026', source_url: SRC.lttTorontoBylaw, last_verified: '2026-07-13' },
  },

  /* ── CPP RETIREMENT PENSION — timing (start at 60 vs 65) ──────────────────── */
  // Federal, nationwide (CPP); Quebec's QPP branch is modelled separately below.
  // Verified 2026-07-14 against canada.ca (ESDC): "before age 65 … decrease by 0.6% each
  // month (7.2%/yr), up to 36% at age 60; after age 65 … increase by 0.7% each month
  // (8.4%/yr), up to 42% at age 70." Adjustment factors are set in the CPP Act, so they
  // are 'statutory'; the dollar AMOUNTS move — the maximum re-indexes each January and
  // the published average is refreshed through the year, so it is 'quarterly'.
  // The maximum/average are CONTEXT ONLY — the calculator requires the user's own
  // Service Canada estimate and never prefills from them.
  // QPP branch verified 2026-07-15 against Retraite Québec: before 65 the pension
  // decreases 0.5%–0.6% PER MONTH — a SLIDING factor, unlike CPP's flat 0.6%. It is 0.5%
  // for a low pension, rising in proportion to 0.6% at the maximum. After 65: 0.7%/month,
  // same as CPP. Max QPP pension at 65 (2026) = $1,507.65, equal to the CPP maximum.
  // Consequence: unlike CPP's constant ~73.9, the QPP break-even age VARIES with pension size.
  cppRetirement: {
    _cadence: 'statutory',
    earlyReductionPerMonth: { value: 0.006, source_url: SRC.cppWhenStart, last_verified: '2026-07-14' }, // flat 0.6%/month before 65
    earlyMaxReduction:      { value: 0.36,  source_url: SRC.cppWhenStart, last_verified: '2026-07-14' }, // 36% at age 60 (60 months early)
    lateIncreasePerMonth:   { value: 0.007, source_url: SRC.cppWhenStart, last_verified: '2026-07-14' }, // reference only, not used on 60-vs-65
    lateMaxIncrease:        { value: 0.42,  source_url: SRC.cppWhenStart, last_verified: '2026-07-14' }, // reference only
    maxAt65Monthly:         { value: 1507.65, source_url: SRC.cppAmount, last_verified: '2026-07-14', cadence: 'january' },   // January 2026 maximum
    averageAt65Monthly:     { value: 877.01,  source_url: SRC.cppAmount, last_verified: '2026-07-14', cadence: 'quarterly' }, // April 2026 average
    qppMaxAt65Monthly:      { value: 1507.65, source_url: SRC.qppFigures,     last_verified: '2026-07-15', cadence: 'january' },
    qppEarlyReductionMin:   { value: 0.005,   source_url: SRC.qppCalculation, last_verified: '2026-07-15' }, // 0.5%/month for a low pension
    qppEarlyReductionMax:   { value: 0.006,   source_url: SRC.qppCalculation, last_verified: '2026-07-15' }, // 0.6%/month at the maximum pension
    qppLateIncreasePerMonth:{ value: 0.007,   source_url: SRC.qppCalculation, last_verified: '2026-07-15' },
  },

  /* ── EI MATERNITY & PARENTAL BENEFITS — federal, nationwide EXCEPT Quebec ─── */
  // Quebec residents use QPIP (below), not this. Verified 2026-07-14 against canada.ca
  // (Service Canada). Official 2026 table:
  //   Maternity (birth parent only, not shareable): up to 15 weeks @ 55%, max $729/wk
  //   Standard parental: up to 40 wks shared / 35 wks one parent @ 55%, max $729/wk
  //   Extended parental: up to 69 wks shared / 61 wks one parent @ 33%, max $437/wk
  // Maternity is ALWAYS paid at 55% — the standard/extended choice only affects PARENTAL.
  // Weeks and replacement rates are set in the EI Act ('statutory'); the weekly MAXIMUMS
  // and the Family Supplement threshold move with the MIE every January.
  eiParental: {
    _cadence: 'statutory',
    standardRate:       { value: 0.55, source_url: SRC.eiBenefit, last_verified: '2026-07-14' },
    extendedRate:       { value: 0.33, source_url: SRC.eiBenefit, last_verified: '2026-07-14' },
    maxWeeklyStandard:  { value: 729,  source_url: SRC.eiBenefit, last_verified: '2026-07-14', cadence: 'january' }, // = 55% of $68,900 MIE ÷ 52
    maxWeeklyExtended:  { value: 437,  source_url: SRC.eiBenefit, last_verified: '2026-07-14', cadence: 'january' }, // = 33% of $68,900 MIE ÷ 52
    maternityWeeks:     { value: 15,   source_url: SRC.eiMatParental, last_verified: '2026-07-14' },
    standardParental:   { value: { oneParent: 35, shared: 40 }, source_url: SRC.eiMatParental, last_verified: '2026-07-14' }, // sharing adds the 2nd parent's 5 weeks
    extendedParental:   { value: { oneParent: 61, shared: 69 }, source_url: SRC.eiMatParental, last_verified: '2026-07-14' }, // sharing adds the 2nd parent's 8 weeks
    waitingPeriodWeeks: { value: 1,    source_url: SRC.eiAfterApply, last_verified: '2026-07-14' }, // one unpaid week at the start of the claim
    familySupplementIncomeThreshold: { value: 25921, source_url: SRC.eiBenefit, last_verified: '2026-07-14', cadence: 'january' }, // Family Supplement (up to 80%) — NOT modelled
  },

  /* ── QPIP MATERNITY / PARENTAL BENEFITS — Quebec's replacement for federal EI ── */
  // Quebec residents use the Québec Parental Insurance Plan, NOT federal EI. QPIP has its
  // own two-plan structure (Basic = longer, lower %; Special = shorter, higher %), its own
  // weeks/percentages per benefit type, its own MIE ($103,000, not EI's $68,900), and NO
  // waiting period (EI has one unpaid week). Verified 2026-07-15 against quebec.ca.
  // Official 2026 table:
  //   Basic  : maternity 18 wk @70%; paternity 5 wk @70%; parental 32 wk (7 @70% + 25 @55%);
  //            +4 shareable wk @55% when each parent takes ≥8 shareable weeks.
  //   Special: maternity 15 wk @75%; paternity 3 wk @75%; parental 25 wk @75%;
  //            +3 shareable wk @75% when each parent takes ≥6 shareable weeks.
  // NO-WAITING-PERIOD FLAG: modelled as 0 weeks. An explicit "no waiting period" sentence
  // was NOT located on the reachable RQAP/quebec.ca pages (the site migration redirects
  // several deep links to hubs); the benefit-start-date page shows benefits payable from
  // the interruption-of-earnings date with no unpaid week, consistent with QPIP's design.
  // Adoption benefits differ again (no maternity/paternity) and are NOT modelled.
  qpipParental: {
    _cadence: 'statutory',
    maxInsurableEarnings: { value: 103000, source_url: SRC.qpip, last_verified: '2026-07-15', cadence: 'january' },
    waitingPeriodWeeks:   { value: 0, source_url: SRC.qpipPlans, last_verified: '2026-07-15' }, // see NO-WAITING-PERIOD FLAG above
    basic: { value: {   // long term, lower percentage
        maternityWeeks: 18, paternityWeeks: 5, exclusiveRate: 0.70,
        parentalWeeks1: 7, parentalRate1: 0.70, parentalWeeks2: 25, parentalRate2: 0.55,
        sharedBonusWeeks: 4, sharedBonusRate: 0.55, rateLabel: '70% → 55%',
      }, source_url: SRC.qpipPlans, last_verified: '2026-07-15' },
    special: { value: { // short term, higher percentage
        maternityWeeks: 15, paternityWeeks: 3, exclusiveRate: 0.75,
        parentalWeeks: 25, parentalRate: 0.75,
        sharedBonusWeeks: 3, sharedBonusRate: 0.75, rateLabel: '75%',
      }, source_url: SRC.qpipPlans, last_verified: '2026-07-15' },
  },
};
