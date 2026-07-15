# Follow-ups

Standalone technical debt / cleanup items, tracked separately from feature work.

**Scheduling rule:** these are for **after the hub is complete**. Do NOT fold them into
the Quebec build — that session stays clean (QPP / QPIP / 16.5% abatement + the inaugural
constants audit only).

---

## 1. Ontario health premium — reconcile the duplication

**What:** The Ontario Health Premium schedule exists in two places that can drift:
- `assets/js/tax-engine.js` → `ontarioHealthPremium()` — the six bands **hardcoded** as
  imperative code. **This is what the engine actually uses.**
- `data/tax-constants-2026.js` → `provinces.ON.healthPremium` — the same six bands as
  **formula-string data** (`"lesser(300, 0.06*(income-20000))"`, …). Currently unused by
  the engine; documentation only.

**Why deferred:** the string-formula data doesn't cleanly map onto the hardcoded function,
so wiring the engine to read the data would be a real refactor (a small formula
interpreter or restructured band data), not a safe mechanical swap.

**Fix options:** either (a) drive `ontarioHealthPremium()` from the data so there's one
source, or (b) drop the unused data array and keep the engine hardcode as the single
source, moving its provenance into a comment. Pick one; don't leave both live.

**Risk if ignored:** low today (values agree), but a future January update could change one
and not the other.

---

## 2. Migrate benefit-program constants into the provenance file

**What:** These still hold their constants inline in `data/rates-2026.js` (with their own
source/verified comments), outside the `{ value, source_url, last_verified }` structure:
`ONTARIO_ESA`, `CCB`, `LTT`, `CPP_RETIREMENT`, `EI_PARENTAL`, `QPIP_PARENTAL`.

**Why deferred / why separate cadence:** they don't index on the January income-tax cycle —
- CCB re-indexes every **July** (benefit year July–June),
- LTT and ESA change only by **legislation**,
- CPP-timing and EI mat/parental follow federal benefit updates.

So they were intentionally left out of `tax-constants-2026.js` and the January audit.

**Fix:** extend the provenance structure to cover them (possibly a sibling
`benefit-constants-2026.js`), and add their cadences to `MAINTENANCE.md` so each gets a
re-verification trigger appropriate to it (not the January one).

---

## 3. Quebec — model the deduction for workers (and other credits)

**What:** The Quebec take-home / self-employed calc models only the basic personal amount
(bundled credit base). It does **not** apply the **deduction for workers** (Revenu Québec
TP-1 line 201; 2026 max **$1,450**), a near-universal Quebec-only *deduction* from provincial
taxable income for anyone with employment/business income.

**Impact:** the calc overstates Quebec provincial tax by ~$1,450 × 14% = **~$203** for most
employees (understating net take-home by the same). Verified against Revenu Québec, flagged
in the Quebec brackets/BPA build — intentionally out of scope there (that build was scoped to
"BPA as a non-refundable credit"; the worker deduction is a deduction, not a credit).

**Why deferred:** it needs a Quebec-specific *provincial* taxable base — the deduction
reduces Quebec taxable income only, not federal, so the engine's single shared `taxable`
can't carry it. Other Quebec non-refundable credits (age, living-alone, dependants, etc.)
are also unmodelled but are situational, not near-universal like this one.

**Fix:** give `provincialTax` an optional province-specific income adjustment (Quebec:
subtract `min(0.06 × workIncome, 1450)` before the bracket step), stamped in the constants
file with its Revenu Québec source + cadence.
