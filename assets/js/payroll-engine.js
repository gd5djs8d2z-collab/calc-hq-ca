/**
 * payroll-engine.js — per-pay-period withholding by CRA's T4127 Option 1 formulas, 123rd edition
 * (pay dates from July 1, 2026). Separate from tax-engine.js on purpose: payroll withholding is
 * not annual tax. It uses the July PRORATED figures for BC, NL and PEI, applies BC's tax
 * reduction (S) and Alberta's supplementary credit (K5P), and leaves out credits that only the
 * return gives (Ontario LIFT, the NL/NB/NS/PE low-income reductions, Manitoba's family tax
 * benefit). Quebec is not covered: its provincial withholding follows Revenu Québec's TP-1015.F.
 *
 * Factor names follow T4127 so each line can be checked against the guide:
 *   P pay periods · I gross pay for the period · C CPP · C2 CPP2 · EI · F5 the enhanced-CPP
 *   deduction · A annual taxable income · TC/TCP TD1 claims · K, KP bracket constants ·
 *   K1/K1P claim credits · K2/K2P CPP/EI credits · K4 Canada employment amount · T1/T2 annual
 *   federal/provincial tax. Every rate and amount is a stamped constant; none is typed here.
 */
import { FEDERAL, PROVINCES, CPP, EI, PAYROLL } from '/data/rates-2026.js';

export const PAYROLL_JURISDICTIONS = ['ON', 'AB', 'BC', 'SK', 'MB', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'];
export const PAY_FREQUENCIES = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };

// Round half up to the cent, as CRA does (450 × 1.63% = $7.335 → $7.34). Binary floating point
// stores 7.335 as 7.33499…, so the product is first settled at six decimals.
const settle = (x) => Number(x.toFixed(6));
const cents = (x) => Math.round(settle(x * 100)) / 100;
const pos = (x) => (x > 0 ? x : 0);
const baseShare = CPP.baseCpp1Rate / CPP.rate;          // 0.0495 / 0.0595: the credit-eligible part
const enhShare = CPP.enhancedCpp1Rate / CPP.rate;       // 0.0100 / 0.0595: the deductible part (F5)
const maxBaseCpp = cents(CPP.baseCpp1Rate * (CPP.ympe - CPP.basicExemption)); // $3,519.45

/** Bracket constants from rates and thresholds: K_i = K_{i-1} + (R_i − R_{i-1}) × A_i, rounded
 *  to the dollar as T4127 Table 8.1 publishes them. */
export function bracketConstants(brackets) {
  const out = [0]; let k = 0;
  for (let i = 1; i < brackets.length; i++) { k += (brackets[i].rate - brackets[i - 1].rate) * brackets[i].min; out.push(Math.round(settle(k))); }
  return out;
}

/** The province's July 2026 payroll table: annual brackets with the prorated overrides. */
export function payrollBrackets(code) {
  const br = PROVINCES[code].brackets.map((b) => ({ ...b }));
  if (code === 'BC') br[0].rate = PAYROLL.BC.lowestRate;
  if (code === 'PE') br[br.length - 1].rate = PAYROLL.PE.topRate;
  return br;
}

const pick = (brackets, kp, A) => { let i = 0; while (i + 1 < brackets.length && A >= brackets[i + 1].min) i++; return { rate: brackets[i].rate, k: kp[i] }; };

function phaseOut(p, ni) {               // a BPA that falls linearly between two incomes
  if (ni <= p.phaseOutStart) return p.max;
  if (ni >= p.phaseOutEnd) return p.min;
  return cents(p.max - (ni - p.phaseOutStart) * ((p.max - p.min) / (p.phaseOutEnd - p.phaseOutStart)));
}

/** The TD1 default claim: the basic personal amount, with the federal, Yukon and Manitoba
 *  phase-outs on net income (A) and NL's prorated July BPA. */
export function defaultClaims(code, A = 0) {
  const fed = phaseOut(FEDERAL.bpa, A);
  const p = PROVINCES[code];
  let prov = p.bpa;
  if (code === 'NL') prov = PAYROLL.NL.bpa;
  else if (code === 'YT') prov = fed;                                 // BPAYT = BPAF
  else if (p.bpaPhaseOut) prov = phaseOut(p.bpaPhaseOut, A);          // BPAMB
  return { fed, prov };
}

/** Ontario Health Premium (factor V2) from the stamped schedule. */
function healthPremium(A) {
  for (const band of PROVINCES.ON.healthPremium) {
    if (band.upTo !== null && A > band.upTo) continue;
    if ('premium' in band) return band.premium;
    const [, cap, base, rate, start] = band.formula.match(/lesser\(([\d.]+),\s*(?:([\d.]+)\+)?([\d.]+)\*\(income-([\d.]+)\)\)/).map(Number);
    return Math.min(cap, (base || 0) + rate * (A - start));
  }
  return 0;
}

/**
 * Deductions for one pay period.
 * @param {object} o
 *   code      jurisdiction (not QC)        pay   gross pay for the period (I = PI = IE)
 *   periods   52, 26, 24 or 12             td1Fed / td1Prov  TD1 claims; omitted = the basic amounts
 *   ytd       { pensionable, cpp, cpp2, ei } amounts already deducted this year, all optional
 */
export function payrollDeductions({ code, pay, periods: P, td1Fed, td1Prov, ytd = {} }) {
  if (!PAYROLL_JURISDICTIONS.includes(code)) throw new Error(`payrollDeductions: ${code} is not covered`);
  const I = pay, D = ytd.cpp || 0, D2 = ytd.cpp2 || 0, D1 = ytd.ei || 0, PIytd = ytd.pensionable || 0;

  // CPP (T4127 ch. 6): the per-period exemption is truncated to the cent (Table 6.1).
  const exemption = Math.floor((CPP.basicExemption / P) * 100) / 100;
  const C = cents(pos(Math.min(CPP.maxEmployeeContribution - D, CPP.rate * (I - exemption))));
  const W = Math.max(PIytd, CPP.ympe);
  const C2 = cents(pos(Math.min(CPP.cpp2.maxContribution - D2, (PIytd + I - W) * CPP.cpp2.rate)));
  // EI (ch. 7)
  const ei = cents(pos(Math.min(EI.maxEmployeePremium - D1, EI.rate * I)));

  // Step 1: annual taxable income
  const F5 = cents(C * enhShare + C2);
  const A = pos(P * (I - F5));

  const claims = defaultClaims(code, A);
  const TC = td1Fed ?? claims.fed, TCP = td1Prov ?? claims.prov;
  // CPP and EI credits (K2): P × the period's amount, capped at the annual maximum. T4127's note
  // to Step 2: once the year's contributions reach the maximum, use the maximum for that period
  // and the rest of the year, and otherwise the greater of the annualized amount and what has
  // already been deducted.
  const cppReached = D + C >= CPP.maxEmployeeContribution - 0.005, eiReached = D1 + ei >= EI.maxEmployeePremium - 0.005;
  const cppCredit = cppReached ? maxBaseCpp : Math.min(Math.max(P * C, D) * baseShare, maxBaseCpp);
  const eiCredit = eiReached ? EI.maxEmployeePremium : Math.min(Math.max(P * ei, D1), EI.maxEmployeePremium);
  const gross = P * I;

  // Steps 2-3: federal
  const fb = FEDERAL.brackets, fk = bracketConstants(fb), f = pick(fb, fk, A), low = fb[0].rate;
  const K1 = low * TC, K2 = low * (cppCredit + eiCredit), K4 = Math.min(low * gross, low * FEDERAL.canadaEmploymentAmountBase);
  const T1 = pos(f.rate * A - f.k - K1 - K2 - K4);

  // Steps 4-5: provincial
  const pb = payrollBrackets(code), pk = code === 'BC' ? PAYROLL.BC.kp : bracketConstants(pb), pr = pick(pb, pk, A), plow = pb[0].rate;
  const K1P = plow * TCP, K2P = plow * (cppCredit + eiCredit);
  const K4P = code === 'YT' ? Math.min(plow * gross, plow * FEDERAL.canadaEmploymentAmountBase) : 0;
  const K5P = code === 'AB' ? pos((K1P + K2P - PAYROLL.AB.k5pThreshold) * PAYROLL.AB.k5pRate) : 0;
  const T4 = pos(pr.rate * A - pr.k - K1P - K2P - K4P - K5P);
  let V1 = 0, V2 = 0, S = 0;
  if (code === 'ON') {
    for (const t of PROVINCES.ON.surtax) V1 += pos(T4 - t.over) * t.rate;
    V2 = healthPremium(A);
    S = pos(Math.min(T4 + V1, 2 * PROVINCES.ON.ontarioTaxReduction.basic - (T4 + V1)));
  } else if (code === 'BC') {
    const b = PAYROLL.BC;
    const cap = A <= b.taxReductionStart ? b.taxReductionMax
      : A <= b.taxReductionCutoff ? b.taxReductionMax - (A - b.taxReductionStart) * b.taxReductionRate : 0;
    S = Math.min(T4, pos(cap));
  }
  const T2 = pos(T4 + V1 + V2 - S);

  const federalTax = cents(T1 / P), provincialTax = cents(T2 / P);
  const employeeTotal = cents(federalTax + provincialTax + C + C2 + ei);
  return {
    gross: cents(I), federalTax, provincialTax, cpp: C, cpp2: C2, ei,
    totalDeductions: employeeTotal, net: cents(I - employeeTotal),
    employer: { cpp: C, cpp2: C2, ei: cents(ei * (EI.employerRate / EI.rate)) },
    factors: { P, A, F5, TC, TCP, T1, T2, T4, V1, V2, S, K5P, K4P },
  };
}
