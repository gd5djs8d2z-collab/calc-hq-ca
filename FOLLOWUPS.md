# Follow-ups

Standalone technical debt / cleanup items, tracked separately from feature work.

**Scheduling rule:** these are standalone cleanups to pick up as capacity allows. The Quebec
build (QPP / QPIP / 16.5% abatement / brackets + BPA / deduction for workers) and the
inaugural constants audit are complete — no Quebec-specific modelling gaps remain.

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

## 3. French section (`/fr/`) — localize the shared chrome

**What:** The first French page (`/fr/salaire-net-quebec/`) reuses the **English** header nav
and footer as-is (flagged in-page and in its commit). The page content, calculator UI, and
FAQ are native Québec French, but the surrounding chrome is not.

**Fix when more French pages exist:**
- Localize the header nav (Paie, Revenu supplémentaire, Prestations, Emploi, Propriété) and the
  footer (À propos, Politique de confidentialité, Avis, Contact) for `/fr/` pages.
- Add a `/fr/` section index so the bare `/fr/` path resolves instead of 404ing.
- Have the French copy on `/fr/salaire-net-quebec/` reviewed by a native Québécois speaker
  before promoting it (built as reviewable, not final).

**Why deferred:** localized chrome only pays off once there are several French pages; the nav
links would also need French destination pages, which don't exist yet.

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

## Done

- **Quebec — deduction for workers** (was item 3): implemented 2026-07-16. `provincialTax`
  now subtracts `min(6% × eligible work income, $1,450)` from the Quebec taxable base in both
  `calcTakeHome` and `calcSelfEmployed` (`workerDeduction` on `PROVINCES.QC`), verified against
  Revenu Québec line 201 / Work Chart 201. This was the last Quebec-specific modelling gap.
