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
  oasAmount:      'https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/benefit-amount.html',
  oasEligibility: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/eligibility.html',
  oasWhenStart:   'https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/when-start.html',
  oasRecoveryTax: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/recovery-tax.html',
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
  // ── Disability tax credit (DTC) ──
  // The indexation chart is the ONE page carrying the federal disability amount, the under-18
  // supplement and the attendant/childcare reduction threshold together, per year. It shows a
  // ~4-year rolling window, so earlier years come from archived captures of this same URL —
  // each value read from ITS OWN tax-year column, never from the snapshot's date.
  dtcIndexation:  'https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/adjustment-personal-income-tax-benefit-amounts.html',
  // Per-jurisdiction, per-year provincial disability amount + that year's lowest bracket rate:
  // the CRA Information Guide (Form 5XXX-PC) published with each year's tax package.
  dtcGuide:       'https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html',
  dtcAmounts:     'https://www.canada.ca/en/revenue-agency/services/tax/individuals/segments/tax-credits-deductions-persons-disabilities/disability-tax-credit/claiming-dtc.html',
  // 10-year reassessment limit for a retroactive DTC claim (taxpayer relief / T1-ADJ window).
  dtcRetro:       'https://www.canada.ca/en/revenue-agency/services/tax/individuals/segments/tax-credits-deductions-persons-disabilities/disability-tax-credit.html',
  // ── Child disability benefit (CDB) ──
  // NAME COLLISION: this is the CHILD disability benefit — the CCB supplement for a child
  // under 18 approved for the DTC, paid monthly with the CCB. It is NOT the adult
  // "Canada Disability Benefit" (also abbreviated CDB), a separate working-age program
  // with its own estimator on service.canada.ca. Confirmed by reading both pages: this one
  // is titled "Child disability benefit" and requires CCB + DTC eligibility.
  cdb:            'https://www.canada.ca/en/revenue-agency/services/child-family-benefits/child-disability-benefit.html',
  // The CCB "how payments are calculated" page corroborates the CDB maximum and states that
  // the CDB is added to the CCB payment (they are computed independently, then summed).
  ccbCalc:        'https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit-overview/canada-child-benefit-we-calculate-your-ccb.html',
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
        { min: 0,      max: 50363,    rate: 0.0506 },
        { min: 50363,  max: 100728,   rate: 0.0770 },
        { min: 100728, max: 115648,   rate: 0.1050 },
        { min: 115648, max: 140430,   rate: 0.1229 },
        { min: 140430, max: 190405,   rate: 0.1470 },
        { min: 190405, max: 265545,   rate: 0.1680 },
        { min: 265545, max: Infinity, rate: 0.2050 },
      ], source_url: SRC.bcRates, last_verified: '2026-07-23' }, // 2026-07-23: brackets[0] corrected 0.0560→0.0506 (dropped-zero data-entry error); re-verified all 7 rates vs gov.bc.ca tax-rates + CRA T4032BC ("multiply line 17 by 5.06% × 0.0506")
      bpa: { value: 13216, source_url: SRC.bcCredits, last_verified: '2026-07-13' },
      bpaCreditRate: { value: 0.0506, source_url: SRC.bcRates, last_verified: '2026-07-23' }, // = brackets[0].rate (lowest-rate rule); corrected 0.056→0.0506 with the bracket fix above
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

  /* ── OLD AGE SECURITY (OAS) — pension amount + recovery tax (clawback) ────── */
  // TWO different clocks run here, which is the single most confusing thing about OAS:
  //   1. The PENSION AMOUNT re-indexes QUARTERLY (Jan/Apr/Jul/Oct), like GIS — these are
  //      the July–September 2026 figures. Bump them together with GIS (MAINTENANCE Rule 3).
  //   2. The RECOVERY TAX runs on a JULY–JUNE period keyed to the PRIOR calendar year's
  //      income. The current period is July 2026–June 2027, assessed on 2025 income against
  //      the 2025 threshold. Those nodes carry cadence 'july' individually.
  // Rates and residency rules are statutory and don't move on either clock.
  //
  // All values confirmed live 2026-07-18 across four canada.ca pages, which agree:
  //   "Old Age Security payment amounts"  — max $751.97 (65–74) / $827.17 (75+), Jul–Sep 2026
  //   "How much you could receive"        — same maxima; "partial pension based on how long
  //                                          you lived in Canada (years lived in Canada ÷ 40)";
  //                                          "Each January, April, July, and October pension
  //                                          amounts are increased"; 10% bump at 75
  //   "Do you qualify"                    — 10 years' residence in Canada / 20 years abroad
  //   "OAS pension recovery tax"          — the recovery-period table below, and the 15% rate
  oas: {
    _cadence: 'quarterly',
    effectiveQuarter: { value: 'July–September 2026', source_url: SRC.oasPayments, last_verified: '2026-07-18' },
    // Maximum monthly pension at full (40-year) residence, before any recovery tax.
    maxMonthly65to74: { value: 751.97, source_url: SRC.oasPayments, last_verified: '2026-07-18' },
    maxMonthly75plus: { value: 827.17, source_url: SRC.oasPayments, last_verified: '2026-07-18' },
    // Automatic 10% increase the month after the 75th birthday (permanent, since July 2022).
    // Stored for display/explanation — the 75+ maximum above already includes it.
    age75IncreaseRate: { value: 0.10, source_url: SRC.oasAmount, last_verified: '2026-07-18', cadence: 'statutory' },

    // Residence: full pension at 40 years after age 18; otherwise years ÷ 40.
    fullResidenceYears:        { value: 40, source_url: SRC.oasAmount,      last_verified: '2026-07-18', cadence: 'statutory' },
    minResidenceInCanada:      { value: 10, source_url: SRC.oasEligibility, last_verified: '2026-07-18', cadence: 'statutory' },
    minResidenceOutsideCanada: { value: 20, source_url: SRC.oasEligibility, last_verified: '2026-07-18', cadence: 'statutory' },

    // Deferral: 0.6%/month (7.2%/yr) after 65, to a maximum of 36% at age 70.
    deferralIncreasePerMonth: { value: 0.006, source_url: SRC.oasWhenStart, last_verified: '2026-07-18', cadence: 'statutory' },
    deferralMaxIncrease:      { value: 0.36,  source_url: SRC.oasWhenStart, last_verified: '2026-07-18', cadence: 'statutory' },
    deferralMaxAge:           { value: 70,    source_url: SRC.oasWhenStart, last_verified: '2026-07-18', cadence: 'statutory' },
    startAge:                 { value: 65,    source_url: SRC.oasWhenStart, last_verified: '2026-07-18', cadence: 'statutory' },

    // Recovery tax (clawback). 15% of net world income above the minimum threshold.
    recoveryRate:        { value: 0.15,  source_url: SRC.oasRecoveryTax, last_verified: '2026-07-18', cadence: 'statutory' },
    recoveryPeriod:      { value: 'July 2026 – June 2027', source_url: SRC.oasRecoveryTax, last_verified: '2026-07-18', cadence: 'july' },
    recoveryIncomeYear:  { value: 2025,   source_url: SRC.oasRecoveryTax, last_verified: '2026-07-18', cadence: 'july' },
    recoveryThreshold:   { value: 93454,  source_url: SRC.oasRecoveryTax, last_verified: '2026-07-18', cadence: 'july' },
    // "Maximum income recovery threshold" — the income at which OAS is fully clawed back.
    // PUBLISHED figures, not derived: canada.ca notes they are "based on maximum OAS pension
    // amounts", so they apply to someone on the full pension. The calculator therefore caps
    // an individual's repayment at their OWN annual OAS rather than recomputing this ceiling
    // — see the note on OAS.estimate() in rates-2026.js.
    fullRecoveryCeiling65to74: { value: 152062, source_url: SRC.oasRecoveryTax, last_verified: '2026-07-18', cadence: 'july' },
    fullRecoveryCeiling75plus: { value: 157923, source_url: SRC.oasRecoveryTax, last_verified: '2026-07-18', cadence: 'july' },
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

  /* ── DISABILITY TAX CREDIT (DTC) — federal + provincial disability amounts ──── */
  // The DTC is a NON-REFUNDABLE credit. The disability AMOUNT is multiplied by each
  // jurisdiction's LOWEST bracket rate for THAT TAX YEAR — never the marginal rate, and
  // never the current year's rate applied backwards (see the Alberta near-miss in
  // MAINTENANCE.md: AB cut 10%→8% for 2026 only). It can only reduce tax payable to zero.
  //
  // CURRENT YEAR = 2025. CRA had not published the 2026 PROVINCIAL packages when this was
  // built, so the calculator treats 2025 as the current year and the retroactive window is
  // 2016–2025 (exactly the 10-year CRA reassessment limit). Federal 2026 IS published and
  // is stamped below, ready for when the provincial side catches up.
  //
  // Cadence: historical years are 'statutory' — a CLOSED tax year's amount is immutable and
  // can never go stale. Only currentTaxYear carries 'january': it is the tripwire that fires
  // each New Year to prompt adding the new year's row.
  //
  // GAPS are represented by an ABSENT year key, never by a guessed number. The engine skips
  // absent years and the page lists them explicitly. See MAINTENANCE.md for each one.
  dtc: {
    _cadence: 'statutory',
    currentTaxYear:      { value: 2025, source_url: SRC.dtcAmounts, last_verified: '2026-07-24', cadence: 'january' },
    maxRetroactiveYears: { value: 10,   source_url: SRC.dtcRetro,   last_verified: '2026-07-24' },
    earliestYear:        { value: 2016, source_url: SRC.dtcRetro,   last_verified: '2026-07-24' },

    // ── FEDERAL, per tax year (CRA indexation chart) ─────────────────────────
    // amount        = base disability amount (T1 line 31600)
    // supplement    = MAXIMUM supplement for a claimant under 18
    // careThreshold = attendant/childcare expenses above which the supplement is reduced
    // rate          = the FEDERAL lowest rate for that year: 15% through 2024, 14.5% in the
    //                 2025 transition year, 14% from 2026 (confirmed on CRA T4032).
    federal: {
      y2016: { value: { amount: 8001, supplement: 4667, careThreshold: 2734, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2017: { value: { amount: 8113, supplement: 4733, careThreshold: 2772, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2018: { value: { amount: 8235, supplement: 4804, careThreshold: 2814, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2019: { value: { amount: 8416, supplement: 4909, careThreshold: 2875, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2020: { value: { amount: 8576, supplement: 5003, careThreshold: 2930, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2021: { value: { amount: 8662, supplement: 5053, careThreshold: 2959, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2022: { value: { amount: 8870, supplement: 5174, careThreshold: 3030, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2023: { value: { amount: 9428, supplement: 5500, careThreshold: 3221, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2024: { value: { amount: 9872, supplement: 5758, careThreshold: 3373, rate: 0.15 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2025: { value: { amount: 10138, supplement: 5914, careThreshold: 3464, rate: 0.145 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
      y2026: { value: { amount: 10341, supplement: 6032, careThreshold: 3533, rate: 0.14 },
             source_url: SRC.dtcIndexation, last_verified: '2026-07-24' },
    },

    // ── PROVINCIAL / TERRITORIAL, per jurisdiction per tax year ──────────────
    // amount = base disability amount on that year's Form 428 (line 58440; line 5844 before
    //          2019), from the CRA Information Guide FOR THAT YEAR.
    // rate   = that jurisdiction's lowest bracket rate FOR THAT YEAR.
    // NO provincial under-18 supplement is stored: every Information Guide defers it to
    // Worksheet XX428, which canada.ca publishes as PDF ONLY. Documented gap — a child claim
    // therefore computes the provincial portion on the BASE amount, which UNDERSTATES it.
    // Yukon mirrors the FEDERAL amount — its own guide states Yukon's non-refundable credits
    // 'are the same as those for the federal non-refundable tax credits' — valued at YT 6.4%.
    provincial: {
      ON: { // Ontario
        y2016: { value: { amount: 8088, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 8217, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 8365, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 8549, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 8712, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 8790, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 9001, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 9586, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 10017, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 10298, rate: 0.0505 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      BC: { // British Columbia
        y2016: { value: { amount: 7521, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 7656, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 7809, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 8012, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 8212, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 8303, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 8477, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 8986, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 9435, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 9699, rate: 0.0506 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      AB: { // Alberta
        y2016: { value: { amount: 14232, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 14417, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 14590, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 14940, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 14940, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 14940, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 15284, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 16201, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 16882, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 17219, rate: 0.1 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      SK: { // Saskatchewan
        // y2016 — GAP: no primary source for the lowest rate (see MAINTENANCE.md). Omitted, not guessed.
        // y2017 — GAP: SK cut its rate a half point EFFECTIVE JULY 1, 2017, so the 2017 ANNUAL
        //   rate is a blend. Saskatchewan's own backgrounder: "the 2017 rates reflect the impact
        //   of the half point reduction midway through the 2017 taxation year." The CRA rates
        //   page captured 2017-07-17 still showed the PRE-CUT 11% — a mid-year snapshot, not the
        //   settled annual rate — so it must NOT be used. The blended figure would be our own
        //   arithmetic, not a published value, so the year is omitted rather than computed.
        // y2018 — GAP: no primary source for the lowest rate (see MAINTENANCE.md). Omitted, not guessed.
        y2019: { value: { amount: 9464, rate: 0.105 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 9464, rate: 0.105 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 9559, rate: 0.105 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 9789, rate: 0.105 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 10405, rate: 0.105 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 10894, rate: 0.105 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 13986, rate: 0.105 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      MB: { // Manitoba
        y2016: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 6180, rate: 0.108 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      NS: { // Nova Scotia
        y2016: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 7341, rate: 0.0879 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      NB: { // New Brunswick
        y2016: { value: { amount: 7900, rate: 0.0968 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 8011, rate: 0.0968 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 8131, rate: 0.0968 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 8310, rate: 0.0968 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 8468, rate: 0.0968 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 8552, rate: 0.094 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 8757, rate: 0.094 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 9309, rate: 0.094 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 9747, rate: 0.094 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 10010, rate: 0.094 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      NL: { // Newfoundland and Labrador
        y2016: { value: { amount: 5939, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 6058, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 6240, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 6352, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 6409, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 6435, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 6615, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 7005, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 7299, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 7467, rate: 0.087 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      PE: { // Prince Edward Island
        y2016: { value: { amount: 6890, rate: 0.098 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 6890, rate: 0.098 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 6890, rate: 0.098 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 6890, rate: 0.098 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 6890, rate: 0.098 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 6890, rate: 0.098 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 6890, rate: 0.098 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        // y2023 — GAP: no primary source for the lowest rate (see MAINTENANCE.md). Omitted, not guessed.
        // y2024 — GAP: no primary source for the lowest rate (see MAINTENANCE.md). Omitted, not guessed.
        y2025: { value: { amount: 6890, rate: 0.095 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      YT: { // Yukon
        y2016: { value: { amount: 8001, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 8113, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 8235, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 8416, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 8576, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 8662, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 8870, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 9428, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 9872, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 10138, rate: 0.064 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      NT: { // Northwest Territories
        y2016: { value: { amount: 11419, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 11579, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 11753, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 12011, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 12239, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 12362, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        // y2022 — GAP: CRA's archived 2022 NT guide declares 'New for 2023' and repeats
        //   the 2023 figure. No primary source for the true 2022 amount; omitted, not guessed.
        y2023: { value: { amount: 13456, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 14088, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 14469, rate: 0.059 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
      NU: { // Nunavut
        y2016: { value: { amount: 12947, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2017: { value: { amount: 13128, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2018: { value: { amount: 13325, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2019: { value: { amount: 13618, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2020: { value: { amount: 13877, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2021: { value: { amount: 14016, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2022: { value: { amount: 14352, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2023: { value: { amount: 15256, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2024: { value: { amount: 15973, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
        y2025: { value: { amount: 16405, rate: 0.04 }, source_url: SRC.dtcGuide, last_verified: '2026-07-24' },
      },
    },
  },

  /* ── CHILD DISABILITY BENEFIT (CDB) — the CCB supplement for a DTC-approved child ── */
  // NAME COLLISION, read this first. "CDB" here is the CHILD disability benefit: a tax-free
  // MONTHLY supplement paid with the Canada child benefit for a child under 18 who is approved
  // for the disability tax credit. It is NOT the adult "Canada Disability Benefit", a separate
  // working-age program that shares the initials and has its own government estimator. Both
  // source pages were read to confirm which program each describes.
  //
  // JULY–JUNE BENEFIT YEAR, like the CCB (MAINTENANCE Rule 5) — NOT the January cycle. The
  // maximum and the phase-out threshold re-index every July, using the PREVIOUS calendar
  // year's adjusted family net income (July 2026–June 2027 runs on 2025 AFNI).
  //
  // THE REDUCTION IS SINGLE-TIER, which is where this differs from the CCB it rides on:
  //   reduction = rate x max(0, AFNI - threshold),  rate = 3.2% (ONE eligible child)
  //                                                        5.7% (TWO OR MORE eligible children)
  // The CCB by contrast is TWO-tier (7/13.5/19/23% between its two thresholds, then
  // 3.2/5.7/8/9.5% above the second). The two are computed INDEPENDENTLY on the same AFNI and
  // then added together; neither reduces the other.
  //
  // ⚠ DO NOT REUSE ccb.tier2Rates HERE, and do not point this block at ccb.threshold2.
  //   - ccb.tier2Rates has FOUR brackets (1/2/3/4+ children). The CDB has only TWO: "one
  //     child" and "two or MORE". A family with 3 DTC-eligible children uses 5.7%, where the
  //     CCB would use 8% — reusing the CCB array would overstate the reduction for 3+ children.
  //   - "eligible children" means DTC-APPROVED children, not all children in the family.
  //   - cdb threshold and ccb.threshold2 happen to be the same number in every published year
  //     (2023-2026), but they are separate published figures in separate sections of the CRA
  //     indexation chart. They are stamped separately here, and invariants() asserts they stay
  //     equal FOR THE SAME BENEFIT YEAR so a future divergence is caught rather than assumed.
  //
  // Verified 2026-07-25 against three independent primary sources that agree: the CRA child
  // disability benefit page (SRC.cdb), the CRA indexation chart's own "Child disability
  // benefit (CDB)" section (SRC.craIndexation), and the CCB calculation page (SRC.ccbCalc).
  // Each prior year below was read from an ARCHIVED capture of SRC.cdb and attributed to the
  // benefit period THE DOCUMENT DECLARES ("For the period of July X to June Y"), never to the
  // snapshot date — and each independently matches the indexation chart's column for that year.
  cdb: {
    _cadence: 'july',
    // Tripwire: goes STALE each July so the new benefit year gets added (same role as
    // dtc.currentTaxYear on the January cycle).
    currentBenefitYearStart: { value: 2026, source_url: SRC.cdb, last_verified: '2026-07-25' },
    // CRA automatically calculates the current benefit year plus this many previous years on a
    // first CDB approval; older years need a written request. Drives the backdated view.
    autoCalculatedPriorYears: { value: 2, source_url: SRC.cdb, last_verified: '2026-07-25', cadence: 'statutory' },

    // Reduction rates. 'statutory' is EARNED, not inherited from the CCB precedent: read from
    // archived captures of SRC.cdb declaring four DIFFERENT benefit years (Jul2023–Jun2024,
    // Jul2024–Jun2025, Jul2025–Jun2026, Jul2026–Jun2027) — 3.2% / 5.7% in every one.
    // Re-confirm if CRA ever restates them; they are NOT on the indexation chart.
    rateOneChild:        { value: 0.032, source_url: SRC.cdb, last_verified: '2026-07-25', cadence: 'statutory' },
    rateTwoPlusChildren: { value: 0.057, source_url: SRC.cdb, last_verified: '2026-07-25', cadence: 'statutory' },

    // Per benefit year, keyed by the START year (y2026 = July 2026 – June 2027).
    // maxPerChild = annual maximum per DTC-eligible child; threshold = AFNI above which the
    // benefit is reduced; baseYear = the tax year whose AFNI is used.
    // Closed years are 'statutory' (immutable once the year has ended); the CURRENT year
    // inherits the block's 'july' cadence so it is chased each July.
    years: {
      y2023: { value: { benefitYear: 'July 2023 – June 2024', baseYear: 2022, maxPerChild: 3173, threshold: 75537 },
               source_url: SRC.cdb, last_verified: '2026-07-25', cadence: 'statutory' },
      y2024: { value: { benefitYear: 'July 2024 – June 2025', baseYear: 2023, maxPerChild: 3322, threshold: 79087 },
               source_url: SRC.cdb, last_verified: '2026-07-25', cadence: 'statutory' },
      y2025: { value: { benefitYear: 'July 2025 – June 2026', baseYear: 2024, maxPerChild: 3411, threshold: 81222 },
               source_url: SRC.cdb, last_verified: '2026-07-25', cadence: 'statutory' },
      y2026: { value: { benefitYear: 'July 2026 – June 2027', baseYear: 2025, maxPerChild: 3480, threshold: 82847 },
               source_url: SRC.cdb, last_verified: '2026-07-25' },
    },
  },
};
