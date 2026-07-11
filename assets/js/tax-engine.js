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
  FEDERAL, CPP, EI, PROVINCES, PROVINCE_STATUS, LIVE_PROVINCES,
} from '/data/rates-2026.js';

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

/* ── CPP / CPP2 ──────────────────────────────────────────────────────────── */
export function calcCPP(earnings, { selfEmployed = false } = {}) {
  const pensionable1 = Math.max(0, Math.min(earnings, CPP.ympe) - CPP.basicExemption);
  const cpp1 = Math.min(pensionable1 * CPP.rate, CPP.maxEmployeeContribution);

  const pensionable2 = Math.max(0, Math.min(earnings, CPP.cpp2.yampe) - CPP.ympe);
  const cpp2 = Math.min(pensionable2 * CPP.cpp2.rate, CPP.cpp2.maxContribution);

  const employee = cpp1 + cpp2;
  const total = selfEmployed ? employee * CPP.selfEmployedMultiplier : employee;

  // Split for tax treatment (based on the employee-share amounts).
  const enhanced = cpp1 * (CPP.enhancedCpp1Rate / CPP.rate) + cpp2; // income deduction
  const base = cpp1 * (CPP.baseCpp1Rate / CPP.rate);                // credit-eligible

  return { cpp1, cpp2, employee, total, enhanced, base };
}

/* ── EI ──────────────────────────────────────────────────────────────────── */
export function calcEI(earnings, { quebec = false } = {}) {
  const cfg = quebec ? { rate: EI.quebec.rate, max: EI.quebec.maxEmployeePremium }
                     : { rate: EI.rate,        max: EI.maxEmployeePremium };
  const premium = Math.min(Math.min(earnings, EI.maxInsurableEarnings) * cfg.rate, cfg.max);
  return { premium, rate: cfg.rate };
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

function provincialTax(taxableIncome, code, { cppBase, eiPremium }) {
  const prov = PROVINCES[code];
  let basic = bracketTax(taxableIncome, prov.brackets);
  const credits = (prov.bpa + cppBase + eiPremium) * prov.bpaCreditRate;
  basic = Math.max(0, basic - credits);

  // Ontario surtax on basic Ontario tax (cumulative tiers).
  let surtax = 0;
  for (const t of (prov.surtax || [])) {
    if (basic > t.over) surtax += (basic - t.over) * t.rate;
  }
  const health = code === 'ON' ? ontarioHealthPremium(taxableIncome) : 0;
  return { basic, surtax, health, total: basic + surtax + health };
}

function federalTax(taxableIncome, netIncome, { cppBase, eiPremium }) {
  let tax = bracketTax(taxableIncome, FEDERAL.brackets);
  const credits =
    (federalBPA(netIncome) + cppBase + eiPremium) * FEDERAL.bpa.creditRate
    + FEDERAL.canadaEmploymentAmountMaxCredit;
  return Math.max(0, tax - credits);
}

/**
 * Full annual take-home for employment income.
 * Returns gross, each deduction, net, and average rate.
 */
export function calcTakeHome(gross, code) {
  const cpp = calcCPP(gross);
  const ei = calcEI(gross);
  // Enhanced CPP is deductible from taxable income.
  const taxable = Math.max(0, gross - cpp.enhanced);
  const fed = federalTax(taxable, gross, { cppBase: cpp.base, eiPremium: ei.premium });
  const prov = provincialTax(taxable, code, { cppBase: cpp.base, eiPremium: ei.premium });

  const totalTax = fed + prov.total;
  const totalDeductions = totalTax + cpp.employee + ei.premium;
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
  const cpp = calcCPP(netBusinessIncome, { selfEmployed: true });
  const halfCppDeduction = cpp.total / 2; // employer-half is deductible from income
  const ei = optIntoEI ? calcEI(netBusinessIncome) : { premium: 0 };

  // Enhanced CPP (on the employee-equivalent share) is also deductible.
  const taxable = Math.max(0, netBusinessIncome - halfCppDeduction - cpp.enhanced);
  const fed = federalTax(taxable, netBusinessIncome, { cppBase: cpp.base, eiPremium: ei.premium });
  const prov = provincialTax(taxable, code, { cppBase: cpp.base, eiPremium: ei.premium });

  const incomeTax = fed + prov.total;
  const totalObligation = incomeTax + cpp.total + ei.premium;

  return {
    gross: netBusinessIncome,
    incomeTax,
    federalTax: fed,
    provincialTax: prov.total,
    cpp: cpp.total,
    ei: ei.premium,
    totalObligation,
    afterTax: netBusinessIncome - totalObligation,
    averageRate: netBusinessIncome > 0 ? totalObligation / netBusinessIncome : 0,
    mustRegisterHST: netBusinessIncome >= 30000,
  };
}
