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

## 4. Stamp the remaining unstamped leaves in `provinces` / `cpp` / `qpp`

**What:** `scripts/check-constants.mjs` (added 2026-07-18) reports **44 UNSTAMPED leaves** —
bare values inside blocks that were never converted to provenance nodes. They split in two:

- **Material — affects tax output, should be stamped:**
  `provinces.<XX>.bpaCreditRate` (all 13 jurisdictions — the rate the BPA is credited at),
  `provinces.ON.healthPremiumMax`, `cpp.selfEmployedMultiplier`, `qpp.selfEmployedMultiplier`.
- **Structural — labels and model flags, arguably not sourceable facts:**
  `provinces.<XX>.name`, `provinces.<XX>.indexation`, `provinces.QC.bpaBundlesContributions`,
  `provinces.YT.includesCanadaEmploymentAmount`.

**Why deferred:** found by the new checker while migrating item 2, but outside that task's
scope. Not touched — the six-object migration was kept clean.

**Consequence today:** the checker exits 1 out of the box, so it cannot gate CI until these
are resolved. Decide per group: stamp the material ones; for the structural ones either stamp
them or give the checker an explicit "structural, not sourced" marker so it stops flagging
them. Do **not** silence them wholesale — `bpaCreditRate` is a real tax constant.

---

## Done

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
