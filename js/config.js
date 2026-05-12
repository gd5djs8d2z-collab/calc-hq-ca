/**
 * config.js — Calc-HQ.ca
 * Single source of truth for all rates, constants, and jurisdiction metadata.
 * Canadian jurisdiction only. CRA / ESDC sourced, 2026 tax year.
 *
 * TAX_YEAR and LAST_UPDATED are declared first for rapid verification.
 */

const TAX_YEAR = 2026;
const LAST_UPDATED = "2026-01-01";

// ─── Site identity ───────────────────────────────────────────────────────────

const SITE = {
  name: "Calc-HQ.ca",
  domain: "https://calc-hq.ca",
  description: "Canadian payroll, CPP, EI, and take-home pay calculators. CRA-sourced rates, 2026.",
  contactEmail: "partnerships@calc-hq.ca",
  jurisdiction: "Canada",
  province: "Ontario",
  taxAuthority: "CRA",
  payrollAuthority: "ESDC",
};

// ─── Federal income tax brackets ─────────────────────────────────────────────
// Source: CRA T1 / TaxTips.ca, 2026 federal tax rates (Income Tax Act s. 117)
// Rate reduced from 15% → 14% for 2026 (full year).

const FEDERAL_BRACKETS = [
  { min: 0,       max: 58523,   rate: 0.14  },
  { min: 58523,   max: 117045,  rate: 0.205 },
  { min: 117045,  max: 181440,  rate: 0.26  },
  { min: 181440,  max: 258482,  rate: 0.29  },
  { min: 258482,  max: null,    rate: 0.33  },
];

// ─── Federal personal amounts ─────────────────────────────────────────────────
// Source: CRA, 2026. Full enhanced BPA for income ≤ $181,440; phases to minimum
// at $258,482. For payroll/calculator purposes, use maximum (most common case).

const FEDERAL_BPA     = 16452; // Maximum Basic Personal Amount (income ≤ $181,440)
const FEDERAL_BPA_MIN = 14829; // Minimum Basic Personal Amount (income ≥ $258,482)

// ─── CPP — Canada Pension Plan ───────────────────────────────────────────────
// Source: ESDC / CRA, 2026
// YMPE increased from $71,300 (2025) to $74,600 (2026).

const CPP_RATE             = 0.0595;   // Employee contribution rate (5.95%)
const CPP_MAX_PENSIONABLE  = 74600;    // Year's Maximum Pensionable Earnings (YMPE)
const CPP_EXEMPTION        = 3500;     // Year's Basic Exemption (YBE) — unchanged
const CPP_MAX_CONTRIBUTION = 4230.45;  // Maximum employee CPP contribution 2026

// CPP2 — Second earnings ceiling (enhancement phase-in)
// Source: ESDC / canada.ca, 2026
// YAMPE increased from $81,900 (2025) to $85,000 (2026).

const CPP2_RATE           = 0.04;    // Additional employee rate (4.0%)
const CPP2_YMPE2          = 85000;   // Second YMPE ceiling (YAMPE)
const CPP2_MAX_CONTRIBUTION = 416.00; // Maximum CPP2 employee contribution 2026

// ─── EI — Employment Insurance ───────────────────────────────────────────────
// Source: ESDC / canada.ca, 2026
// Rate reduced from 1.64% (2025) to 1.63% (2026).
// MIE increased from $65,700 (2025) to $68,900 (2026).

const EI_RATE            = 0.0163;    // Employee premium rate (1.63%)
const EI_MAX_INSURABLE   = 68900;     // Maximum insurable earnings
const EI_MAX_PREMIUM     = 1123.07;   // Maximum annual employee premium
const EI_EMPLOYER_FACTOR = 1.4;       // Employer rate = employee rate × 1.4

// ─── Ontario provincial tax brackets ─────────────────────────────────────────
// Source: Ontario Ministry of Finance / TaxTips.ca, 2026
// Bracket 1 ceiling: $51,446 (2025) → $53,891 (2026)
// Bracket 2 ceiling: $102,894 (2025) → $107,785 (2026)

const ONTARIO_BRACKETS = [
  { min: 0,        max: 53891,   rate: 0.0505 },
  { min: 53891,    max: 107785,  rate: 0.0915 },
  { min: 107785,   max: 150000,  rate: 0.1116 },
  { min: 150000,   max: 220000,  rate: 0.1216 },
  { min: 220000,   max: null,    rate: 0.1316 },
];

// ─── Ontario personal amounts ─────────────────────────────────────────────────
// Source: CRA T4032-ON Jan 2026 / canada.ca
// Ontario non-refundable basic personal tax credit: $12,989 (2026)

const ONTARIO_BPA = 12989; // Ontario Basic Personal Amount

// ─── Ontario surtax ───────────────────────────────────────────────────────────
// Source: Ontario Ministry of Finance / rcicnews.com confirmed, 2026
// Applied to Ontario tax payable (after Ontario BPA credit), not to income.
// Threshold 1: $5,710 (2025) → $5,818 (2026)
// Threshold 2: $7,307 (2025) → $7,446 (2026)

const ONTARIO_SURTAX_THRESHOLD_1 = 5818;  // 20% surtax on Ontario tax above this
const ONTARIO_SURTAX_THRESHOLD_2 = 7446;  // Additional 36% (total 56%) above this
const ONTARIO_SURTAX_RATE_1      = 0.20;
const ONTARIO_SURTAX_RATE_2      = 0.36;

// ─── Convenience export object ────────────────────────────────────────────────
// Used by network.js and page scripts to access all constants.

const CONFIG = {
  TAX_YEAR,
  LAST_UPDATED,
  SITE,
  FEDERAL_BRACKETS,
  FEDERAL_BPA,
  FEDERAL_BPA_MIN,
  CPP_RATE,
  CPP_MAX_PENSIONABLE,
  CPP_EXEMPTION,
  CPP_MAX_CONTRIBUTION,
  CPP2_RATE,
  CPP2_YMPE2,
  CPP2_MAX_CONTRIBUTION,
  EI_RATE,
  EI_MAX_INSURABLE,
  EI_MAX_PREMIUM,
  EI_EMPLOYER_FACTOR,
  ONTARIO_BRACKETS,
  ONTARIO_BPA,
  ONTARIO_SURTAX_THRESHOLD_1,
  ONTARIO_SURTAX_THRESHOLD_2,
  ONTARIO_SURTAX_RATE_1,
  ONTARIO_SURTAX_RATE_2,
};
