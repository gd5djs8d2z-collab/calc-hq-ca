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

/* amount × rate, rounded to the cent half up — how a premium or contribution is actually
   charged. A plain float product can't be trusted for this: 1.63% has no exact binary form (the
   nearest double is 0.016299999999999998…), so 45,000 × 0.0163 comes out 733.4999999999999 and a
   true $733.50 displays as $733. Scaling the amount to whole cents and the rate to a whole number
   keeps the product exact, so a true half cent is exactly .5 and rounds up. The guard refuses a
   rate with more than 7 decimal places instead of silently truncating it. See MAINTENANCE.md,
   "Money is rounded to the cent". */
const RATE_SCALE = 1e7;
function centsOf(amount, rate) {
  const scaledRate = Math.round(rate * RATE_SCALE);
  if (Math.abs(rate * RATE_SCALE - scaledRate) > 1e-6) throw new Error(`centsOf: rate ${rate} has more than 7 decimal places`);
  return Math.round(Math.round(amount * 100) * scaledRate / RATE_SCALE) / 100;
}

/* ── EI ──────────────────────────────────────────────────────────────────── */
export function calcEI(earnings, { quebec = false } = {}) {
  const cfg = quebec ? { rate: EI.quebec.rate, max: EI.quebec.maxEmployeePremium }
                     : { rate: EI.rate,        max: EI.maxEmployeePremium };
  const premium = Math.min(centsOf(Math.min(earnings, EI.maxInsurableEarnings), cfg.rate), cfg.max);
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
 * Low-income tax reduction — BC's tax reduction and the NL, NB, NS and PE low-income tax
 * reductions all take this shape, applied against provincial tax after the credits. Full
 * base amount when net income is at/under the threshold, then reduced by rate × (net
 * income − threshold); it can lower provincial tax to zero but never below. Only the
 * single-filer base is modelled — the spouse, dependant and child amounts need inputs the
 * calculators don't collect. netIncome here is the taxable-income proxy the engine already uses (≈ line
 * 23600 for a simple employment case). Returns 0 when the province defines no reduction.
 */
function provincialTaxReduction(prov, netIncome) {
  const tr = prov.taxReduction;
  if (!tr) return 0;
  return Math.max(0, tr.base - Math.max(0, netIncome - tr.threshold) * tr.rate);
}

/**
 * Provincial basic personal amount. Flat for most jurisdictions; Yukon uses the
 * federal income-tested BPA (max down to min across a net-income band) and Manitoba
 * phases its BPA out to $0 between $200,000 and $400,000, so a province may instead
 * define `bpaPhaseOut`.
 */
function provincialBPA(prov, netIncome) {
  const p = prov.bpaPhaseOut;
  if (!p) return prov.bpa;
  if (netIncome <= p.phaseOutStart) return p.max;
  if (netIncome >= p.phaseOutEnd) return p.min;
  const frac = (netIncome - p.phaseOutStart) / (p.phaseOutEnd - p.phaseOutStart);
  return p.max - (p.max - p.min) * frac;
}

function provincialTax(taxableIncome, code, { cppBase, eiPremium, netIncome = taxableIncome, workIncome = 0, extraCredit = 0, employmentIncome = 0, employment = true }) {
  const prov = PROVINCES[code];
  // Quebec's deduction for workers (line 201): 6% of eligible work income (employment +
  // net business income), capped, reduces the provincial taxable base only — never federal.
  // Defined on Quebec alone; other jurisdictions leave provincialTaxable === taxableIncome.
  let provincialTaxable = taxableIncome;
  if (prov.workerDeduction && workIncome > 0) {
    const wd = Math.min(prov.workerDeduction.rate * workIncome, prov.workerDeduction.max);
    provincialTaxable = Math.max(0, taxableIncome - wd);
  }
  let basic = bracketTax(provincialTaxable, prov.brackets);
  // Credit base: BPA + CPP base + EI, plus (Yukon only) the Canada Employment Amount.
  // Quebec is the exception — its basic amount already bundles the QPP/QPIP/EI credits
  // (Revenu Québec, Line 350), so the contribution amounts are NOT added on top.
  let creditBase = provincialBPA(prov, netIncome);
  if (!prov.bpaBundlesContributions) creditBase += cppBase + eiPremium;
  if (prov.includesCanadaEmploymentAmount && employment) creditBase += FEDERAL.canadaEmploymentAmountBase;
  // extraCredit: additional non-refundable credit amounts valued at the lowest rate — e.g.
  // the provincial disability amount (DTC). Added to the base BEFORE surtax so an Ontario
  // surtax rides on the reduced provincial tax automatically. Defaults to 0, so every
  // existing caller's output is unchanged.
  creditBase += extraCredit;
  // Manitoba family tax benefit (Income Tax Act s.4.6(16.1)): a credit AMOUNT of the basic $2,065
  // less 9% of income, valued at the lowest rate with the other credits. Only the basic amount —
  // the spouse, dependant, age and disability add-ons need inputs the calculators don't collect.
  // Income is netIncome, the same figure the BPA phase-outs read.
  if (prov.familyTaxBenefit) {
    const f = prov.familyTaxBenefit;
    creditBase += Math.max(0, f.amount - f.rate * netIncome);
  }
  const credits = creditBase * prov.bpaCreditRate;
  basic = Math.max(0, basic - credits);

  // Provincial low-income tax reduction (BC, NL, NB, NS, PE) — capped at tax payable.
  const reduction = Math.min(basic, provincialTaxReduction(prov, taxableIncome));
  basic = Math.max(0, basic - reduction);

  // Ontario surtax on basic Ontario tax (cumulative tiers).
  let surtax = 0;
  for (const t of (prov.surtax || [])) {
    if (basic > t.over) surtax += (basic - t.over) * t.rate;
  }

  // Ontario tax reduction (Taxation Act, 2007, s.20; ON428 lines 74–81): twice the basic
  // reduction minus Ontario tax after surtax, never below zero and never more than that tax.
  // It applies AFTER the surtax and BEFORE the Health Premium, which it cannot reduce. Only the
  // basic amount is modelled — not the per-dependant amounts (see the pages' disclaimers).
  let onReduction = 0;
  if (prov.ontarioTaxReduction) {
    const taxBefore = basic + surtax;
    onReduction = Math.min(taxBefore, Math.max(0, 2 * prov.ontarioTaxReduction.basic - taxBefore));
  }

  // Ontario LIFT credit (Taxation Act, 2007, s.21.1(3.1); Schedule ON428-A; ON428 line 85):
  // 5.05% (the lowest rate) of EMPLOYMENT income, capped at the maximum, less 5% of adjusted net
  // income over the individual threshold. Taken from what is left after the tax reduction,
  // never below zero, and before the Health Premium, which it cannot reduce. employmentIncome
  // defaults to 0, so only callers that pass it (calcTakeHome) get LIFT — self-employment income
  // never qualifies. Individual test only: there is no spouse input, so the family-income test
  // (which can only shrink the credit) is not applied — the pages say so. Adjusted net income is
  // taken as taxableIncome, which is net income (line 23600) for the cases this engine models.
  let lift = 0;
  if (prov.ontarioLift && employmentIncome > 0) {
    const L = prov.ontarioLift;
    const base = Math.min(L.max, prov.brackets[0].rate * employmentIncome);
    const credit = Math.max(0, base - L.phaseOutRate * Math.max(0, taxableIncome - L.individualThreshold));
    lift = Math.min(Math.max(0, basic + surtax - onReduction), credit);
  }

  const health = code === 'ON' ? ontarioHealthPremium(taxableIncome) : 0;
  return { basic, surtax, health, taxReduction: reduction + onReduction + lift, lift, total: basic + surtax - onReduction - lift + health };
}

function federalTax(taxableIncome, netIncome, { cppBase, eiPremium, quebecAbatement = false, extraCredit = 0, employment = true }) {
  let tax = bracketTax(taxableIncome, FEDERAL.brackets);
  // extraCredit: additional non-refundable credit valued at the lowest federal rate — e.g.
  // the federal disability amount (DTC). Applied to basic federal tax before the Quebec
  // abatement below, so a Quebec resident's DTC is correctly netted by the 16.5% abatement.
  // Defaults to 0 → existing callers unchanged.
  const credits =
    (federalBPA(netIncome) + cppBase + eiPremium + extraCredit) * FEDERAL.bpa.creditRate
    + (employment ? FEDERAL.canadaEmploymentAmountMaxCredit : 0);
  // "Basic federal tax" (T1 line 42900): bracket tax after non-refundable credits.
  const basicFederal = Math.max(0, tax - credits);
  // Refundable Quebec abatement (T1 line 44000 = line 42900 × 16.5%): Quebec residents
  // reduce basic federal tax by 16.5%. No federal surtax exists in this engine, so the
  // abatement applies directly to basicFederal — the exact CRA base, no interpolation.
  return quebecAbatement ? basicFederal * (1 - QUEBEC.federalAbatementRate) : basicFederal;
}

/**
 * Income tax alone on income that carries no CPP, EI or Canada Employment Amount — interest,
 * rental or pension income, say. The same federalTax/provincialTax every calculator uses, with
 * the employment-only credits switched off (the `employment` flag defaults on, so no existing
 * caller changes). The tax-bracket pages difference this to get the textbook marginal rate.
 */
export function calcIncomeTax(taxableIncome, code) {
  const fed = federalTax(taxableIncome, taxableIncome, { cppBase: 0, eiPremium: 0, quebecAbatement: code === 'QC', employment: false });
  const prov = provincialTax(taxableIncome, code, { cppBase: 0, eiPremium: 0, employment: false });
  return {
    federalTax: fed,
    provincialTax: prov.total,
    provincialBasic: prov.basic,
    surtax: prov.surtax,
    healthPremium: prov.health,
    totalTax: fed + prov.total,
  };
}

/**
 * Full annual take-home for employment income.
 * Returns gross, each deduction, net, and average rate.
 */
export function calcTakeHome(gross, code, { extraFederalCredit = 0, extraProvincialCredit = 0, deduction = 0, otherIncome = 0 } = {}) {
  const isQC = code === 'QC';
  const cpp = calcCPP(gross, { plan: pensionPlan(code) }); // QPP for Quebec, CPP elsewhere
  // Quebec pays the REDUCED federal EI rate plus a QPIP premium; elsewhere, plain EI.
  const ei = calcEI(gross, { quebec: isQC });
  const qpip = isQC ? calcQPIP(gross) : { premium: 0 };
  const eiTypePremium = ei.premium + qpip.premium;
  // Enhanced CPP is deductible from taxable income.
  // deduction: an optional deduction claimed on the return (an FHSA contribution, say). It lowers
  // taxable and net income but not the CPP/EI base, which is earnings. Defaults to 0, so
  // calcTakeHome(gross, code) is byte-identical to before.
  // otherIncome: optional income on top of the salary that carries no CPP or EI and earns no
  // employment credits — a taxable capital gain, say. It raises taxable and net income only.
  // Defaults to 0, so existing callers are unchanged.
  const netIncome = Math.max(0, gross - deduction) + otherIncome;
  const taxable = Math.max(0, gross - cpp.enhanced - deduction) + otherIncome;
  // extraFederal/ProvincialCredit: optional non-refundable credit AMOUNTS (e.g. the disability
  // amount) folded into each jurisdiction's credit base at the lowest rate. Both default to 0,
  // so calcTakeHome(gross, code) is byte-identical to before. The DTC page uses the difference
  // method — one call with, one without — to read a correctly capped, surtax-aware benefit.
  const fed = federalTax(taxable, netIncome, { cppBase: cpp.base, eiPremium: eiTypePremium, quebecAbatement: isQC, extraCredit: extraFederalCredit });
  const prov = provincialTax(taxable, code, { cppBase: cpp.base, eiPremium: eiTypePremium, netIncome, workIncome: gross, extraCredit: extraProvincialCredit, employmentIncome: gross });

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
  const qpip = withBoth.qpip - withBase.qpip; // 0 outside Quebec
  const totalWithheld = incomeTax + cpp + ei + qpip;
  const net = extra - totalWithheld;

  return {
    extra,
    incomeTax,
    cpp,
    ei,
    qpip,
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
  // QPIP on self-employment income is split like CPP: the premium less what the same earnings
  // would cost at the employee rate is DEDUCTED from income, and only the rest is a credit.
  // Federal: ITA s.60(g) (A − B) and s.118.7(a.2) (credit = premium − the 60(g) amount); CRA
  // line 22300 / Schedule 10. Quebec: the same amount on TP-1 line 248, per Schedule R line 26
  // (premium × 43.736% for 2025 = (0.878 − 0.494) ÷ 0.878, i.e. this same A − B), and CRA's
  // line 22300 page says to claim the same amount on the Revenu Québec return. One deduction
  // therefore serves both returns. Read 2026-10-19; Schedule R 2025-12 was the latest edition.
  const qpipDeduction = isQC ? qpip.premium - calcQPIP(netBusinessIncome).premium : 0;

  // Enhanced CPP (on the employee-equivalent share) is also deductible.
  const taxable = Math.max(0, netBusinessIncome - halfCppDeduction - cpp.enhanced - qpipDeduction);
  const fed = federalTax(taxable, netBusinessIncome, { cppBase: cpp.base, eiPremium: eiTypePremium - qpipDeduction, quebecAbatement: isQC });
  const prov = provincialTax(taxable, code, { cppBase: cpp.base, eiPremium: eiTypePremium, netIncome: netBusinessIncome, workIncome: netBusinessIncome });

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
