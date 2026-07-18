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

**What:** The French pages (`/fr/salaire-net-quebec/` and `/fr/calculateur-impot-quebec/`)
reuse the **English** header nav and footer as-is (flagged in-page and in their commits). The
page content, calculator UI, and FAQ are native Québec French, but the surrounding chrome is not.

**Fix when more French pages exist:**
- Localize the header nav (Paie, Revenu supplémentaire, Prestations, Emploi, Propriété) and the
  footer (À propos, Politique de confidentialité, Avis, Contact) for `/fr/` pages.
- ~~Add a `/fr/` section index so the bare `/fr/` path resolves instead of 404ing.~~ **DONE** —
  `/fr/index.html` built (paired with `/` via reciprocal hreflang); bare `/fr/` now resolves.
- **PENDING NATIVE-SPEAKER REVIEW:** the French copy on ALL THREE `/fr/` pages
  (`/fr/` index, `salaire-net-quebec`, `calculateur-impot-quebec`) is built as reviewable, not
  final — have a native Québécois speaker read it before actively promoting the section.

**Why deferred:** localized chrome only pays off once there are several French pages; the nav
links would also need French destination pages, which don't exist yet.

---

---

## Done

- **Stamp the material unstamped leaves** (was item 4): done 2026-07-18, same day it was
  filed. `bpaCreditRate` × 13, `provinces.ON.healthPremiumMax` and `cpp`/`qpp
  .selfEmployedMultiplier` are now stamped nodes, each verified against a primary source:
  CRA T4032 states credits are valued at "the lowest provincial tax rate"; T4032-ON confirms
  the $900 health-premium cap; the CRA CPP table shows the self-employed maximum
  ($8,460.90) is exactly 2× the employee maximum ($4,230.45), and Retraite Québec says
  self-employed workers "pay both shares". The four structural leaves (`name`, `indexation`,
  `bpaBundlesContributions`, `includesCanadaEmploymentAmount`) are exempted by an explicit
  allowlist guarded by a `NEVER_EXEMPT` collision check. **The checker now exits 0 and can
  gate CI.**

- **Migrate benefit-program constants into the provenance file** (was item 2): done
  2026-07-18. `ONTARIO_ESA`, `CCB`, `LTT`, `CPP_RETIREMENT`, `EI_PARENTAL` and
  `QPIP_PARENTAL` now derive from `tax-constants-2026.js` (blocks `ontarioEsa`, `ccb`,
  `ltt`, `cppRetirement`, `eiParental`, `qpipParental`) — **50 values** that were inline
  literals are now stamped nodes. Provenance nodes gained an optional `cadence` field
  (`january` / `july` / `quarterly` / `statutory`, block-level default via `_cadence`), so
  the non-January cycles that justified deferring this are now expressed in the data rather
  than in prose. `rates-2026.js` keeps behaviour only. Engine output byte-identical
  (ON $50,555.75 / QC $48,180.31 at $65k, all 13 jurisdictions unchanged). Verified by
  `scripts/check-constants.mjs`, which also surfaced new item 4.

- **Quebec — deduction for workers** (was item 3): implemented 2026-07-16. `provincialTax`
  now subtracts `min(6% × eligible work income, $1,450)` from the Quebec taxable base in both
  `calcTakeHome` and `calcSelfEmployed` (`workerDeduction` on `PROVINCES.QC`), verified against
  Revenu Québec line 201 / Work Chart 201. This was the last Quebec-specific modelling gap.
