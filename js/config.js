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
// Source: CRA T4032, 2026 federal tax rates

const FEDERAL_BRACKETS = [
  { min: 0,      max: 57375,  rate: 0.15  },
  { min: 57375,  max: 114750, rate: 0.205 },
  { min: 114750, max: 158519, rate: 0.26  },
  { min: 158519, max: 220000, rate: 0.29  },
  { min: 220000, max: null,   rate: 0.33  },
];

// ─── Federal personal amounts ─────────────────────────────────────────────────
// Source: CRA, 2026

const FEDERAL_BPA = 16129; // Basic Personal Amount

// ─── CPP — Canada Pension Plan ───────────────────────────────────────────────
// Source: ESDC, 2026

const CPP_RATE            = 0.0595;   // Employee contribution rate (5.95%)
const CPP_MAX_PENSIONABLE = 71300;    // Year's Maximum Pensionable Earnings (YMPE)
const CPP_EXEMPTION       = 3500;     // Year's Basic Exemption (YBE)
const CPP_MAX_CONTRIBUTION = (CPP_MAX_PENSIONABLE - CPP_EXEMPTION) * CPP_RATE; // ~$4,034.10

// CPP2 — Second earnings ceiling (2024+ enhancement phase-in)
const CPP2_RATE  = 0.04;    // Additional employee rate (4.0%)
const CPP2_YMPE2 = 81900;   // Second YMPE ceiling

// ─── EI — Employment Insurance ───────────────────────────────────────────────
// Source: ESDC, 2026

const EI_RATE            = 0.0166;    // Employee premium rate (1.66%)
const EI_MAX_INSURABLE   = 65700;     // Maximum insurable earnings
const EI_MAX_PREMIUM     = 1090.62;   // Maximum annual employee premium
const EI_EMPLOYER_FACTOR = 1.4;       // Employer rate = employee rate × 1.4

// ─── Ontario provincial tax brackets ─────────────────────────────────────────
// Source: Ontario Ministry of Finance, 2026

const ONTARIO_BRACKETS = [
  { min: 0,       max: 51446,  rate: 0.0505 },
  { min: 51446,   max: 102894, rate: 0.0915 },
  { min: 102894,  max: 150000, rate: 0.1116 },
  { min: 150000,  max: 220000, rate: 0.1216 },
  { min: 220000,  max: null,   rate: 0.1316 },
];

// ─── Ontario personal amounts ─────────────────────────────────────────────────
// Source: Ontario Ministry of Finance, 2026

const ONTARIO_BPA = 12582; // Ontario Basic Personal Amount

// ─── Ontario surtax ───────────────────────────────────────────────────────────
// Source: Ontario Ministry of Finance, 2026
// Applied to Ontario tax payable (after Ontario BPA credit), not to income.

const ONTARIO_SURTAX_THRESHOLD_1 = 5710;  // 20% surtax on Ontario tax above this amount
const ONTARIO_SURTAX_THRESHOLD_2 = 7307;  // Additional 36% (total 56%) above this amount
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
  CPP_RATE,
  CPP_MAX_PENSIONABLE,
  CPP_EXEMPTION,
  CPP_MAX_CONTRIBUTION,
  CPP2_RATE,
  CPP2_YMPE2,
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
