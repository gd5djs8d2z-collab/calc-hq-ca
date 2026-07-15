/**
 * tax-engine.js — shared 2026 Canadian payroll/tax math for every calc-hq.ca tool.
 *
 * All constants come from /data/rates-2026.js. No tax values are hardcoded here — this
 * file only holds the calculation methodology. Update rates once a year in that file.
 *
 * Modelling notes (methodology, not invented figures):
 *  - Marginal bracket stacking for federal + provincial tax.
 *  - Non-refundable credits (BPA, CPP base, EI, Canada Employment Amount) reduce tax at
 *    the lowest bracket rate, matching CRA's credit mechanics.
 *  - The "enhanced" CPP portion (1% of CPP1 + all of CPP2) is deducted from taxable
 *    income; the base CPP portion earns a credit — as CRA applies it.
 *  - Ontario surtax is applied to basic Ontario tax (after the BPA credit), then the
 *    Ontario Health Premium is added.
 *  This is a well-scoped estimate for employment income, not a full T1 return.
 */
import {
  FEDERAL, CPP, QPP, EI, QPIP, QUEBEC, PROVINCES, PROVINCE_STATUS, LIVE_PROVINCES,
} from '/data/rates-2026.js';

// Quebec workers contribute to QPP, not CPP. Everyone else uses CPP.
const pensionPlan = (code) => (code === 'QC' ? QPP : CPP);

export { LIVE_PROVINCES, PROVINCE_STATUS, PROVINCES };

/* ── helpers ─────────────────────────────────────────────────────────────── */
export const isLiveProvince = (code) => LIVE_PROVINCES.includes(code);

export function formatCurrency(n, { cents = false } = {}) {
  const v = Math.round(cents ? n * 100 : n) / (cents ? 100 : 1);
  return v.toLocaleString('en-CA', {
    style: 'currency', currency: 'CAD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export const formatPercent = (r, d = 1) => `${(r * 100).toFixed(d)}%`;

function bracketTax(income, brackets) {
  let tax = 0;
  for (const b of brackets) {
    if (income > b.min) tax += (Math.min(income, b.max) - b.min) * b.rate;
  }
  return tax;
}

/* ── CPP / CPP2 (or QPP / QPP2 for Quebec — same shape, pass `plan`) ───────── */
export function calcCPP(earnings, { selfEmployed = false, plan = CPP } = {}) {
  const pensionable1 = Math.max(0, Math.min(earnings, plan.ympe) - plan.basicExemption);
  const cpp1 = Math.min(pensionable1 * plan.rate, plan.maxEmployeeContribution);

  const pensionable2 = Math.max(0, Math.min(earnings, plan.cpp2.yampe) - plan.ympe);
  const cpp2 = Math.min(pensionable2 * plan.cpp2.rate, plan.cpp2.maxContribution);

  const employee = cpp1 + cpp2;
  const total = selfEmployed ? employee * plan.selfEmployedMultiplier : employee;

  // Split for tax treatment (based on the employee-share amounts).
  const enhanced = cpp1 * (plan.enhancedCpp1Rate / plan.rate) + cpp2; // income deduction
  const base = cpp1 * (plan.baseCpp1Rate / plan.rate);                // credit-eligible

  return { cpp1, cpp2, employee, total, enhanced, base };
}

/* ── EI ──────────────────────────────────────────────────────────────────── */
export function calcEI(earnings, { quebec = false } = {}) {
  const cfg = quebec ? { rate: EI.quebec.rate, max: EI.quebec.maxEmployeePremium }
                     : { rate: EI.rate,        max: EI.maxEmployeePremium };
  const premium = Math.min(Math.min(earnings, EI.maxInsurableEarnings) * cfg.rate, cfg.max);
  return { premium, rate: cfg.rate };
}

/* ── QPIP contribution (Quebec) — paid on top of the reduced federal EI rate ── */
export function calcQPIP(earnings, { selfEmployed = false } = {}) {
  const rate = selfEmployed ? QPIP.selfEmployedRate : QPIP.employeeRate;
  const max = selfEmployed ? QPIP.maxSelfEmployedPremium : QPIP.maxEmployeePremium;
  const premium = Math.min(Math.min(earnings, QPIP.maxInsurableEarnings) * rate, max);
  return { premium, rate };
}

/* Weekly regular EI benefit estimate (55% of average weekly insurable earnings). */
export function calcEIBenefit(annualInsurable) {
  const capped = Math.min(annualInsurable, EI.maxInsurableEarnings);
  const weekly = (capped / 52) * EI.benefitReplacementRate;
  const weeklyMax = (EI.maxInsurableEarnings / 52) * EI.benefitReplacementRate;
  return { weekly: Math.min(weekly, weeklyMax), weeklyMax };
}

/* ── Federal + provincial income tax ─────────────────────────────────────── */
function federalBPA(netIncome) {
  const b = FEDERAL.bpa;
  if (netIncome <= b.phaseOutStart) return b.max;
  if (netIncome >= b.phaseOutEnd) return b.min;
  const frac = (netIncome - b.phaseOutStart) / (b.phaseOutEnd - b.phaseOutStart);
  return b.max - (b.max - b.min) * frac;
}

function ontarioHealthPremium(taxableIncome) {
  if (taxableIncome <= 20000) return 0;
  if (taxableIncome <= 36000) return Math.min(300, 0.06 * (taxableIncome - 20000));
  if (taxableIncome <= 48000) return Math.min(450, 300 + 0.06 * (taxableIncome - 36000));
  if (taxableIncome <= 72000)  return Math.min(600, 450 + 0.25 * (taxableIncome - 48000));
  if (taxableIncome <= 200000) return Math.min(750, 600 + 0.25 * (taxableIncome - 72000));
  return Math.min(900, 750 + 0.25 * (taxableIncome - 200000)); // [CRA] T4032-ON 2026
}

/**
 * BC tax reduction credit — a non-refundable low-income reduction applied against
 * provincial tax. Full base amount when net income is at/under the threshold, then
 * reduced by rate × (net income − threshold); it can lower BC tax to zero but never
 * below. netIncome here is the taxable-income proxy the engine already uses (≈ line
 * 23600 for a simple employment case). Returns 0 when the province defines no reduction.
 */
function provincialTaxReduction(prov, netIncome) {
  const tr = prov.taxReduction;
  if (!tr) return 0;
  return Math.max(0, tr.base - Math.max(0, netIncome - tr.threshold) * tr.rate);
}

/**
 * Provincial basic personal amount. Flat for most jurisdictions; Yukon uses the
 * federal income-tested BPA (max down to min across a net-income band), so a
 * province may instead define `bpaPhaseOut`.
 */
function provincialBPA(prov, netIncome) {
  const p = prov.bpaPhaseOut;
  if (!p) return prov.bpa;
  if (netIncome <= p.phaseOutStart) return p.max;
  if (netIncome >= p.phaseOutEnd) return p.min;
  const frac = (netIncome - p.phaseOutStart) / (p.phaseOutEnd - p.phaseOutStart);
  return p.max - (p.max - p.min) * frac;
}

function provincialTax(taxableIncome, code, { cppBase, eiPremium, netIncome = taxableIncome }) {
  const prov = PROVINCES[code];
  let basic = bracketTax(taxableIncome, prov.brackets);
  // Credit base: BPA + CPP base + EI, plus (Yukon only) the Canada Employment Amount.
  let creditBase = provincialBPA(prov, netIncome) + cppBase + eiPremium;
  if (prov.includesCanadaEmploymentAmount) creditBase += FEDERAL.canadaEmploymentAmountBase;
  const credits = creditBase * prov.bpaCreditRate;
  basic = Math.max(0, basic - credits);

  // Provincial tax reduction (e.g. BC's low-income reduction) — capped at tax payable.
  const reduction = Math.min(basic, provincialTaxReduction(prov, taxableIncome));
  basic = Math.max(0, basic - reduction);

  // Ontario surtax on basic Ontario tax (cumulative tiers).
  let surtax = 0;
  for (const t of (prov.surtax || [])) {
    if (basic > t.over) surtax += (basic - t.over) * t.rate;
  }
  const health = code === 'ON' ? ontarioHealthPremium(taxableIncome) : 0;
  return { basic, surtax, health, taxReduction: reduction, total: basic + surtax + health };
}

function federalTax(taxableIncome, netIncome, { cppBase, eiPremium, quebecAbatement = false }) {
  let tax = bracketTax(taxableIncome, FEDERAL.brackets);
  const credits =
    (federalBPA(netIncome) + cppBase + eiPremium) * FEDERAL.bpa.creditRate
    + FEDERAL.canadaEmploymentAmountMaxCredit;
  // "Basic federal tax" (T1 line 42900): bracket tax after non-refundable credits.
  const basicFederal = Math.max(0, tax - credits);
  // Refundable Quebec abatement (T1 line 44000 = line 42900 × 16.5%): Quebec residents
  // reduce basic federal tax by 16.5%. No federal surtax exists in this engine, so the
  // abatement applies directly to basicFederal — the exact CRA base, no interpolation.
  return quebecAbatement ? basicFederal * (1 - QUEBEC.federalAbatementRate) : basicFederal;
}

/**
 * Full annual take-home for employment income.
 * Returns gross, each deduction, net, and average rate.
 */
export function calcTakeHome(gross, code) {
  const isQC = code === 'QC';
  const cpp = calcCPP(gross, { plan: pensionPlan(code) }); // QPP for Quebec, CPP elsewhere
  // Quebec pays the REDUCED federal EI rate plus a QPIP premium; elsewhere, plain EI.
  const ei = calcEI(gross, { quebec: isQC });
  const qpip = isQC ? calcQPIP(gross) : { premium: 0 };
  const eiTypePremium = ei.premium + qpip.premium;
  // Enhanced CPP is deductible from taxable income.
  const taxable = Math.max(0, gross - cpp.enhanced);
  const fed = federalTax(taxable, gross, { cppBase: cpp.base, eiPremium: eiTypePremium, quebecAbatement: isQC });
  const prov = provincialTax(taxable, code, { cppBase: cpp.base, eiPremium: eiTypePremium, netIncome: gross });

  const totalTax = fed + prov.total;
  const totalDeductions = totalTax + cpp.employee + eiTypePremium;
  const net = gross - totalDeductions;

  return {
    gross,
    federalTax: fed,
    provincialTax: prov.total,
    provincialBasic: prov.basic,
    surtax: prov.surtax,
    healthPremium: prov.health,
    cpp: cpp.employee,
    ei: ei.premium,
    qpip: qpip.premium,
    totalTax,
    totalDeductions,
    net,
    averageRate: gross > 0 ? totalDeductions / gross : 0,
  };
}

/**
 * Tax on an extra lump of income (bonus / commission) stacked on a base salary.
 * Uses the difference method: deductions on (base + extra) minus deductions on base.
 * CPP/EI only bite if the base hasn't already hit the annual max.
 */
export function calcExtraIncome(base, extra, code) {
  const withBase = calcTakeHome(base, code);
  const withBoth = calcTakeHome(base + extra, code);

  const incomeTax = (withBoth.totalTax) - (withBase.totalTax);
  const cpp = withBoth.cpp - withBase.cpp;
  const ei = withBoth.ei - withBase.ei;
  const totalWithheld = incomeTax + cpp + ei;
  const net = extra - totalWithheld;

  return {
    extra,
    incomeTax,
    cpp,
    ei,
    totalWithheld,
    net,
    effectiveRate: extra > 0 ? totalWithheld / extra : 0,
    marginalNote: withBoth.averageRate,
  };
}

/**
 * Pay-raise delta: net take-home difference between current and new salary.
 */
export function calcRaise(current, next, code) {
  const a = calcTakeHome(current, code);
  const b = calcTakeHome(next, code);
  const grossRaise = next - current;
  const netRaise = b.net - a.net;
  return {
    grossRaise,
    netRaise,
    keptShare: grossRaise > 0 ? netRaise / grossRaise : 0,
    monthlyNet: netRaise / 12,
    biweeklyNet: netRaise / 26,
    before: a,
    after: b,
  };
}

/**
 * Self-employed: CPP at the double (employer+employee) rate, EI only if opted in,
 * $30K HST registration threshold. Half of total CPP is deductible from income.
 */
export function calcSelfEmployed(netBusinessIncome, code, { optIntoEI = false } = {}) {
  const isQC = code === 'QC';
  const cpp = calcCPP(netBusinessIncome, { selfEmployed: true, plan: pensionPlan(code) });
  const halfCppDeduction = cpp.total / 2; // employer-half is deductible from income
  const ei = optIntoEI ? calcEI(netBusinessIncome, { quebec: isQC }) : { premium: 0 };
  // QPIP is MANDATORY for self-employed in Quebec (at the single self-employed rate).
  const qpip = isQC ? calcQPIP(netBusinessIncome, { selfEmployed: true }) : { premium: 0 };
  const eiTypePremium = ei.premium + qpip.premium;

  // Enhanced CPP (on the employee-equivalent share) is also deductible.
  const taxable = Math.max(0, netBusinessIncome - halfCppDeduction - cpp.enhanced);
  const fed = federalTax(taxable, netBusinessIncome, { cppBase: cpp.base, eiPremium: eiTypePremium, quebecAbatement: isQC });
  const prov = provincialTax(taxable, code, { cppBase: cpp.base, eiPremium: eiTypePremium, netIncome: netBusinessIncome });

  const incomeTax = fed + prov.total;
  const totalObligation = incomeTax + cpp.total + eiTypePremium;

  return {
    gross: netBusinessIncome,
    incomeTax,
    federalTax: fed,
    provincialTax: prov.total,
    cpp: cpp.total,
    ei: ei.premium,
    qpip: qpip.premium,
    totalObligation,
    afterTax: netBusinessIncome - totalObligation,
    averageRate: netBusinessIncome > 0 ? totalObligation / netBusinessIncome : 0,
    mustRegisterHST: netBusinessIncome >= 30000,
  };
}
