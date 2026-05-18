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
    cluster: "ontario",
    tags: ["raise", "salary increase", "after-tax", "Ontario", "take-home"],
  },
  {
    name: "Ontario Take-Home Pay Calculator",
    url: "https://ontariotakehomecalc.ca",
    description: "Estimate your net take-home pay after federal tax, Ontario provincial tax, CPP, and EI deductions for a given gross salary.",
    cluster: "ontario",
    tags: ["income tax", "Ontario", "take-home", "salary"],
  },
  {
    name: "Ontario Income Tax Calculator",
    url: "https://ontarioincometaxcalc.ca",
    description: "See your full federal and Ontario tax breakdown, marginal rates, surtax, and Ontario Health Premium by income level. 2026 CRA rates.",
    cluster: "ontario",
    tags: ["income tax", "Ontario", "marginal rate", "surtax", "CRA"],
  },
  {
    name: "Marginal Tax Calculator",
    url: "https://marginaltaxcalc.ca",
    description: "Find your combined federal and Ontario marginal tax rate at any income level for 2026.",
    cluster: "ontario",
    tags: ["marginal tax", "Ontario", "federal", "tax rate"],
  },
  {
    name: "CPP Contribution Calculator",
    url: "https://cppcalc.ca",
    description: "Calculate your CPP and CPP2 contributions for 2026 based on pensionable earnings, including the second-tier CPP2 ceiling.",
    cluster: "federal",
    tags: ["CPP", "CPP2", "pension", "ESDC"],
  },
  {
    name: "EI Premium Calculator",
    url: "https://eicalc.ca",
    description: "Calculate Employment Insurance premiums based on insurable earnings using the 2026 ESDC rate and maximum insurable earnings.",
    cluster: "federal",
    tags: ["EI", "employment insurance", "ESDC", "premiums"],
  },
];

// ─── Cluster metadata: accordion titles and descriptions ───────────────────────
// Source of truth for cluster-level copy. Not in HTML. Not in CA_NETWORK entries.

var CLUSTER_META = {
  ontario: {
    title: "Ontario Payroll & Employment",
    description: "Estimate take-home pay, raises, income taxes, and employment earnings for Ontario workers."
  },
  federal: {
    title: "Federal Payroll Contributions",
    description: "Calculate CPP and EI deductions used across Canadian payroll systems."
  }
};

// ─── Render: cluster accordion card ─────────────────────────────────────
// Renders a single expandable accordion card into the target container.
// Collapsed by default. One cluster open at a time (handled by toggle logic).
// Filters calculators from CA_NETWORK by cluster metadata.

function renderClusterTools(clusterName, targetId) {
  var container = document.getElementById(targetId);
  if (!container) return;

  var meta = CLUSTER_META[clusterName];
  if (!meta) return;

  var tools = CA_NETWORK.filter(function(c) { return c.cluster === clusterName; });
  if (tools.length === 0) return;

  var linksHtml = tools.map(function(calc) {
    return (
      '<li class="cluster-accordion-item">' +
        '<a href="' + calc.url + '" target="_blank" rel="noopener">' + calc.name + '</a>' +
      '</li>'
    );
  }).join("");

  container.innerHTML =
    '<div class="cluster-accordion" data-cluster="' + clusterName + '">' +
      '<button class="cluster-accordion-trigger" aria-expanded="false" type="button">' +
        '<span class="cluster-accordion-title">' + meta.title + '</span>' +
        '<span class="cluster-accordion-desc">' + meta.description + '</span>' +
        '<span class="cluster-accordion-chevron" aria-hidden="true">▼</span>' +
      '</button>' +
      '<div class="cluster-accordion-body" hidden>' +
        '<ul class="cluster-accordion-list">' + linksHtml + '</ul>' +
      '</div>' +
    '</div>';

  // Attach toggle behaviour
  var trigger = container.querySelector('.cluster-accordion-trigger');
  var body    = container.querySelector('.cluster-accordion-body');
  var chevron = container.querySelector('.cluster-accordion-chevron');

  trigger.addEventListener('click', function() {
    var isOpen = trigger.getAttribute('aria-expanded') === 'true';

    if (!isOpen) {
      // Close all other open accordions first
      document.querySelectorAll('.cluster-accordion-trigger[aria-expanded="true"]').forEach(function(other) {
        other.setAttribute('aria-expanded', 'false');
        other.querySelector('.cluster-accordion-chevron').textContent = '▼';
        other.nextElementSibling.hidden = true;
      });
      // Open this one
      trigger.setAttribute('aria-expanded', 'true');
      chevron.textContent = '▲';
      body.hidden = false;
    } else {
      // Close this one
      trigger.setAttribute('aria-expanded', 'false');
      chevron.textContent = '▼';
      body.hidden = true;
    }
  });
}

// ─── Render: footer network tools (#footer-network-tools) ────────────────────
// Renders all CA_NETWORK tools as compact footer links.

function renderFooterNetworkTools() {
  var container = document.getElementById("footer-network-tools");
  if (!container) return;

  container.innerHTML = CA_NETWORK.map(function(calc) {
    return '<a href="' + calc.url + '" target="_blank" rel="noopener">' + calc.name + '</a>';
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
  renderClusterTools("ontario", "cluster-ontario-tools");
  renderClusterTools("federal", "cluster-federal-tools");
  renderFooterNetworkTools();
  renderDeductionTable();
});
