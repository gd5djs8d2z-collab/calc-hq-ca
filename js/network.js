/**
 * network.js — Calc-HQ.ca
 * Single source of truth for spoke relationships, calculator cards,
 * related tool links, and footer navigation.
 *
 * All calculator references in HTML must originate from this file.
 * No calculator URLs or relationships may be hardcoded in HTML.
 *
 * Depends on: config.js (loaded before this file)
 */

// ─── GA4 — Google Analytics 4 ─────────────────────────────────────────────────
// Measurement ID: G-W4SWZ1YRS2
// Guard prevents duplicate injection if script is loaded multiple times.

if (!window.__GA4_LOADED) {
  window.__GA4_LOADED = true;
  (function() {
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-W4SWZ1YRS2';
    document.head.appendChild(script);
  })();
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-W4SWZ1YRS2');
}

// ─── Approved Canadian spoke network ─────────────────────────────────────────
// Only approved spoke URLs. Do NOT add placeholders or future tools.

const CA_NETWORK = [
  {
    name: "Ontario Raise Calculator",
    url: "https://ontarioraisecalc.ca",
    description: "Find out how much of your raise you actually keep after Ontario tax, federal tax, CPP, and EI deductions. 2026 rates.",
    cluster: "scenario-planning",
    tags: ["raise", "salary increase", "after-tax", "Ontario", "take-home"],
  },
  {
    name: "Ontario Take-Home Pay Calculator",
    url: "https://ontariotakehomecalc.ca",
    description: "Estimate your net take-home pay after federal tax, Ontario provincial tax, CPP, and EI deductions for a given gross salary.",
    cluster: "take-home-pay",
    tags: ["income tax", "Ontario", "take-home", "salary"],
  },
  {
    name: "Ontario Income Tax Calculator",
    url: "https://ontarioincometaxcalc.ca",
    description: "See your full federal and Ontario tax breakdown, marginal rates, surtax, and Ontario Health Premium by income level. 2026 CRA rates.",
    cluster: "income-tax",
    tags: ["income tax", "Ontario", "marginal rate", "surtax", "CRA"],
  },
  {
    name: "CPP Contribution Calculator",
    url: "https://cppcalc.ca",
    description: "Calculate your CPP and CPP2 contributions for 2026 based on pensionable earnings, including the second-tier CPP2 ceiling.",
    cluster: "payroll-deductions",
    tags: ["CPP", "CPP2", "pension", "ESDC"],
  },
  {
    name: "EI Premium Calculator",
    url: "https://eicalc.ca",
    description: "Calculate Employment Insurance premiums based on insurable earnings using the 2026 ESDC rate and maximum insurable earnings.",
    cluster: "payroll-deductions",
    tags: ["EI", "employment insurance", "ESDC", "premiums"],
  },
];

// ─── Render: homepage calculator cards (#calc-cards) ─────────────────────────

function renderCalcCards() {
  const container = document.getElementById("calc-cards");
  if (!container) return;

  container.innerHTML = CA_NETWORK.map(function(calc) {
    return (
      '<a href="' + calc.url + '" class="calc-card" target="_blank" rel="noopener">' +
        '<span class="calc-card-name">' + calc.name + '</span>' +
        '<span class="calc-card-desc">' + calc.description + '</span>' +
        '<span class="calc-card-cta">Open calculator &rarr;</span>' +
      '</a>'
    );
  }).join("");
}

// ─── Render: related calculators section (#related-calculators) ───────────────

function renderRelatedCalculators(currentUrl) {
  const container = document.getElementById("related-calculators");
  if (!container) return;

  const tools = currentUrl
    ? CA_NETWORK.filter(function(c) { return c.url !== currentUrl; })
    : CA_NETWORK;

  if (tools.length === 0) return;

  container.innerHTML = tools.map(function(calc) {
    return (
      '<a href="' + calc.url + '" class="related-card" target="_blank" rel="noopener">' +
        '<span class="related-card-name">' + calc.name + '</span>' +
        '<span class="related-card-desc">' + calc.description + '</span>' +
      '</a>'
    );
  }).join("");
}

// ─── Render: deduction reference table (index.html) ──────────────────────────
// Populates config-sourced values into the rate reference table.

function renderDeductionTable() {
  function setCell(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  if (typeof CONFIG === "undefined") return;

  setCell("tbl-cpp-rate",    (CONFIG.CPP_RATE * 100).toFixed(2) + "%");
  setCell("tbl-cpp-ceiling", "$" + CONFIG.CPP_MAX_PENSIONABLE.toLocaleString("en-CA") + " YMPE");
  setCell("tbl-cpp2-rate",   (CONFIG.CPP2_RATE * 100).toFixed(2) + "%");
  setCell("tbl-cpp2-ceiling","$" + CONFIG.CPP2_YMPE2.toLocaleString("en-CA") + " YMPE2");
  setCell("tbl-ei-rate",     (CONFIG.EI_RATE * 100).toFixed(2) + "%");
  setCell("tbl-ei-ceiling",  "$" + CONFIG.EI_MAX_INSURABLE.toLocaleString("en-CA"));
  setCell("tbl-federal-bpa", "$" + CONFIG.FEDERAL_BPA.toLocaleString("en-CA"));
  setCell("tbl-tax-year",    CONFIG.TAX_YEAR);
  setCell("footer-tax-year", CONFIG.TAX_YEAR);
}

// ─── Bootstrap: run on DOMContentLoaded ──────────────────────────────────────

document.addEventListener("DOMContentLoaded", function() {
  renderCalcCards();
  renderRelatedCalculators(null);
  renderDeductionTable();
});
