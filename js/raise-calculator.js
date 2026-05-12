/**
 * raise-calculator.js — Ontario Raise Calculator
 * Calc-HQ.ca — Canadian cluster page
 *
 * Computes the after-tax impact of a raise in Ontario, 2026.
 * Uses rates from config.js (loaded before this file).
 *
 * Formula approach:
 *   1. Compute net annual income at current salary
 *   2. Compute net annual income at new salary
 *   3. Net raise = new net − current net
 *   4. Effective rate on raise = 1 − (net raise / gross raise)
 *
 * Deductions modelled:
 *   - Federal income tax (5 brackets, BPA credit, 2026 rates)
 *   - Ontario income tax (5 brackets, Ontario BPA credit, 2026 rates)
 *   - Ontario surtax (20% above $5,818; additional 36% above $7,446)
 *   - CPP (5.95% on earnings $3,500–$74,600; max $4,230.45)
 *   - CPP2 (4.00% on earnings $74,600–$85,000; max $416.00)
 *   - EI (1.63% on earnings up to $68,900; max $1,123.07)
 *
 * Sources: CRA T4032-ON Jan 2026, ESDC 2026, Ontario Ministry of Finance 2026.
 */

"use strict";

// ─── Rate constants (duplicated from config.js for standalone safety) ─────────
// If CONFIG is available (config.js loaded), these are overridden.

const RC = (typeof CONFIG !== "undefined") ? CONFIG : {
  FEDERAL_BRACKETS: [
    { min: 0,       max: 58523,  rate: 0.14  },
    { min: 58523,   max: 117045, rate: 0.205 },
    { min: 117045,  max: 181440, rate: 0.26  },
    { min: 181440,  max: 258482, rate: 0.29  },
    { min: 258482,  max: null,   rate: 0.33  },
  ],
  FEDERAL_BPA:              16452,
  CPP_RATE:                 0.0595,
  CPP_MAX_PENSIONABLE:      74600,
  CPP_EXEMPTION:            3500,
  CPP_MAX_CONTRIBUTION:     4230.45,
  CPP2_RATE:                0.04,
  CPP2_YMPE2:               85000,
  CPP2_MAX_CONTRIBUTION:    416.00,
  EI_RATE:                  0.0163,
  EI_MAX_INSURABLE:         68900,
  EI_MAX_PREMIUM:           1123.07,
  ONTARIO_BRACKETS: [
    { min: 0,        max: 53891,  rate: 0.0505 },
    { min: 53891,    max: 107785, rate: 0.0915 },
    { min: 107785,   max: 150000, rate: 0.1116 },
    { min: 150000,   max: 220000, rate: 0.1216 },
    { min: 220000,   max: null,   rate: 0.1316 },
  ],
  ONTARIO_BPA:                  12989,
  ONTARIO_SURTAX_THRESHOLD_1:   5818,
  ONTARIO_SURTAX_THRESHOLD_2:   7446,
  ONTARIO_SURTAX_RATE_1:        0.20,
  ONTARIO_SURTAX_RATE_2:        0.36,
};

// ─── Tax engine ───────────────────────────────────────────────────────────────

/**
 * Calculate progressive bracket tax on taxable income.
 * @param {number} taxableIncome
 * @param {Array}  brackets — [{min, max, rate}]
 * @returns {number} tax amount
 */
function calcBracketTax(taxableIncome, brackets) {
  if (taxableIncome <= 0) return 0;
  var tax = 0;
  for (var i = 0; i < brackets.length; i++) {
    var b = brackets[i];
    var top = (b.max === null) ? taxableIncome : Math.min(taxableIncome, b.max);
    var bottom = b.min;
    if (taxableIncome <= bottom) break;
    tax += (top - bottom) * b.rate;
  }
  return tax;
}

/**
 * Calculate Ontario surtax on Ontario basic tax.
 * @param {number} ontBasicTax — Ontario tax after BPA credit, before surtax
 * @returns {number} surtax amount
 */
function calcOntarioSurtax(ontBasicTax) {
  var surtax = 0;
  if (ontBasicTax > RC.ONTARIO_SURTAX_THRESHOLD_1) {
    var t1amount = Math.min(ontBasicTax, RC.ONTARIO_SURTAX_THRESHOLD_2) - RC.ONTARIO_SURTAX_THRESHOLD_1;
    surtax += t1amount * RC.ONTARIO_SURTAX_RATE_1;
  }
  if (ontBasicTax > RC.ONTARIO_SURTAX_THRESHOLD_2) {
    surtax += (ontBasicTax - RC.ONTARIO_SURTAX_THRESHOLD_2) * RC.ONTARIO_SURTAX_RATE_2;
  }
  return surtax;
}

/**
 * Calculate CPP employee contribution.
 * Handles CPP (on YMPE) and CPP2 (on YAMPE − YMPE).
 * @param {number} income
 * @returns {{cpp: number, cpp2: number, total: number}}
 */
function calcCPP(income) {
  var pensionable = Math.max(0, Math.min(income, RC.CPP_MAX_PENSIONABLE) - RC.CPP_EXEMPTION);
  var cpp = Math.min(pensionable * RC.CPP_RATE, RC.CPP_MAX_CONTRIBUTION);

  var cpp2Base = 0;
  if (income > RC.CPP_MAX_PENSIONABLE) {
    cpp2Base = Math.min(income, RC.CPP2_YMPE2) - RC.CPP_MAX_PENSIONABLE;
  }
  var cpp2 = Math.min(cpp2Base * RC.CPP2_RATE, RC.CPP2_MAX_CONTRIBUTION);

  return { cpp: cpp, cpp2: cpp2, total: cpp + cpp2 };
}

/**
 * Calculate EI employee premium.
 * @param {number} income
 * @returns {number}
 */
function calcEI(income) {
  var insurable = Math.min(income, RC.EI_MAX_INSURABLE);
  return Math.min(insurable * RC.EI_RATE, RC.EI_MAX_PREMIUM);
}

/**
 * Calculate full annual net income for a given gross salary in Ontario 2026.
 * @param {number} grossIncome — annual gross salary
 * @returns {object} breakdown of all deductions and net income
 */
function calcNetIncome(grossIncome) {
  if (grossIncome <= 0) {
    return {
      gross: 0, federalTax: 0, ontarioTax: 0, ontarioSurtax: 0,
      cpp: 0, cpp2: 0, ei: 0, totalDeductions: 0, net: 0
    };
  }

  // Federal tax
  var fedBPACredit    = RC.FEDERAL_BPA * 0.14;  // 14% × BPA = non-refundable credit
  var fedTaxable      = Math.max(0, grossIncome - RC.FEDERAL_BPA);
  var fedBracketTax   = calcBracketTax(grossIncome, RC.FEDERAL_BRACKETS);
  var federalTax      = Math.max(0, fedBracketTax - fedBPACredit);

  // Ontario tax
  var ontBPACredit    = RC.ONTARIO_BPA * 0.0505; // 5.05% × BPA = non-refundable credit
  var ontBracketTax   = calcBracketTax(grossIncome, RC.ONTARIO_BRACKETS);
  var ontBasicTax     = Math.max(0, ontBracketTax - ontBPACredit);
  var ontarioSurtax   = calcOntarioSurtax(ontBasicTax);
  var ontarioTax      = ontBasicTax + ontarioSurtax;

  // Payroll
  var cppResult       = calcCPP(grossIncome);
  var ei              = calcEI(grossIncome);

  var totalDeductions = federalTax + ontarioTax + cppResult.cpp + cppResult.cpp2 + ei;
  var net             = grossIncome - totalDeductions;

  return {
    gross:          grossIncome,
    federalTax:     federalTax,
    ontarioTax:     ontBasicTax,
    ontarioSurtax:  ontarioSurtax,
    ontarioTaxTotal: ontarioTax,
    cpp:            cppResult.cpp,
    cpp2:           cppResult.cpp2,
    ei:             ei,
    totalDeductions: totalDeductions,
    net:            net,
  };
}

// ─── Pay period divisors ──────────────────────────────────────────────────────

var PAY_PERIODS = {
  "weekly":      52,
  "biweekly":    26,
  "semimonthly": 24,
  "monthly":     12,
  "annual":       1,
};

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtCAD(n) {
  if (typeof n !== "number" || isNaN(n)) return "$0.00";
  var abs = Math.abs(n);
  var str = abs.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "−$" : "$") + str;
}

function fmtPct(n) {
  if (typeof n !== "number" || isNaN(n)) return "0.0%";
  return (n * 100).toFixed(1) + "%";
}

// ─── Main calculate function ──────────────────────────────────────────────────

function calculateRaise() {
  // Read inputs
  var currentSalaryRaw = parseFloat(document.getElementById("current-salary").value.replace(/,/g, ""));
  var newSalaryRaw     = parseFloat(document.getElementById("new-salary").value.replace(/,/g, ""));
  var payFrequency     = document.getElementById("pay-frequency").value;

  // Validation
  var errorEl = document.getElementById("calc-error");
  var resultEl = document.getElementById("result-section");
  errorEl.textContent = "";
  errorEl.hidden = true;

  if (isNaN(currentSalaryRaw) || currentSalaryRaw < 0) {
    errorEl.textContent = "Please enter a valid current annual salary.";
    errorEl.hidden = false;
    resultEl.hidden = true;
    return;
  }
  if (isNaN(newSalaryRaw) || newSalaryRaw < 0) {
    errorEl.textContent = "Please enter a valid new annual salary.";
    errorEl.hidden = false;
    resultEl.hidden = true;
    return;
  }
  if (newSalaryRaw <= currentSalaryRaw) {
    errorEl.textContent = "New salary must be greater than current salary to calculate a raise.";
    errorEl.hidden = false;
    resultEl.hidden = true;
    return;
  }
  if (newSalaryRaw > 2000000) {
    errorEl.textContent = "Please enter a salary below $2,000,000.";
    errorEl.hidden = false;
    resultEl.hidden = true;
    return;
  }

  var periods = PAY_PERIODS[payFrequency] || 26;

  // Calculate
  var current = calcNetIncome(currentSalaryRaw);
  var next    = calcNetIncome(newSalaryRaw);

  var grossRaise     = newSalaryRaw - currentSalaryRaw;
  var netAnnual      = next.net - current.net;
  var netMonthly     = netAnnual / 12;
  var netPerPay      = netAnnual / periods;

  var fedTaxDiff     = next.federalTax    - current.federalTax;
  var ontTaxDiff     = next.ontarioTaxTotal - current.ontarioTaxTotal;
  var cppDiff        = (next.cpp + next.cpp2) - (current.cpp + current.cpp2);
  var eiDiff         = next.ei - current.ei;

  var effectiveRate  = (grossRaise > 0) ? (1 - (netAnnual / grossRaise)) : 0;

  // ─── Render results ──────────────────────────────────────────────────────

  function setTxt(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  setTxt("res-gross-raise",    fmtCAD(grossRaise));
  setTxt("res-federal-diff",   fmtCAD(fedTaxDiff));
  setTxt("res-ontario-diff",   fmtCAD(ontTaxDiff));
  setTxt("res-cpp-diff",       fmtCAD(cppDiff));
  setTxt("res-ei-diff",        fmtCAD(eiDiff));
  setTxt("res-net-annual",     fmtCAD(netAnnual));
  setTxt("res-net-monthly",    fmtCAD(netMonthly));
  setTxt("res-net-perpay",     fmtCAD(netPerPay));
  setTxt("res-effective-rate", fmtPct(effectiveRate));

  // Pay period label
  var periodLabels = {
    "weekly": "week", "biweekly": "two weeks",
    "semimonthly": "semi-monthly pay period", "monthly": "month", "annual": "year"
  };
  var perpayLabel = periodLabels[payFrequency] || "pay period";
  setTxt("res-perpay-label", perpayLabel);

  // Plain-English summary
  var summaryEl = document.getElementById("res-summary");
  if (summaryEl) {
    summaryEl.textContent =
      "You keep approximately " + fmtCAD(netAnnual) + " of your " +
      fmtCAD(grossRaise) + " raise — " +
      fmtCAD(netMonthly) + " per month, or " +
      fmtCAD(netPerPay) + " per " + perpayLabel + ". " +
      "Taxes and deductions take " + fmtPct(effectiveRate) +
      " of your raise before it reaches your bank account.";
  }

  // Current vs new net summary line
  setTxt("res-current-net", fmtCAD(current.net));
  setTxt("res-new-net",     fmtCAD(next.net));
  setTxt("res-current-gross", fmtCAD(currentSalaryRaw));
  setTxt("res-new-gross",     fmtCAD(newSalaryRaw));

  // Show result
  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: "smooth", block: "start" });

  // GA4 event
  if (typeof gtag === "function") {
    gtag("event", "calculator_use", {
      calculator: "ontario-raise-calculator",
      gross_raise: Math.round(grossRaise),
      pay_frequency: payFrequency,
    });
  }
}

// ─── Bind events on DOMContentLoaded ─────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("raise-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      calculateRaise();
    });
  }

  // Allow comma-formatted input
  ["current-salary", "new-salary"].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", function() {
      var raw = parseFloat(this.value.replace(/,/g, ""));
      if (!isNaN(raw) && raw > 0) {
        this.value = raw.toLocaleString("en-CA");
      }
    });
    el.addEventListener("focus", function() {
      this.value = this.value.replace(/,/g, "");
    });
  });

  // Reset button
  var resetBtn = document.getElementById("reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", function() {
      document.getElementById("raise-form").reset();
      var resultEl = document.getElementById("result-section");
      if (resultEl) resultEl.hidden = true;
      var errorEl = document.getElementById("calc-error");
      if (errorEl) { errorEl.hidden = true; errorEl.textContent = ""; }
    });
  }
});
