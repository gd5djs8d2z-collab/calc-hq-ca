/* calc-ui.js — small shared DOM/format helpers for the calculator pages.
   Math lives in tax-engine.js; this only handles input parsing and stub messaging. */

export function parseMoney(v) {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) || n < 0 ? 0 : n;
}

/* Message shown when a user picks a province this build can't compute yet. */
export function provinceStub(code) {
  if (code === 'BC') {
    return "British Columbia's 2026 bracket thresholds aren't locked from the BC government yet, so we're not showing a BC number rather than guessing. Pick Ontario or Alberta for a live estimate.";
  }
  if (code === 'QC') {
    return "Quebec runs on QPP and QPIP instead of CPP and EI, plus a 16.5% federal abatement — genuinely different math that we build and verify separately. Pick Ontario or Alberta for a live estimate.";
  }
  return null;
}

export function el(id) { return document.getElementById(id); }
