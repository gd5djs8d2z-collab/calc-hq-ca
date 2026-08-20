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

## Done

- **Page figures vs the pack — JSON-LD drift gate** (was item 2): done 2026-08-20.
  `scripts/check-schema.mjs` parses every `application/ld+json` block in the repo (72 blocks
  across 43 files) and fails on two things: a block that no longer parses, and a money/percent
  figure matching a value the pack has since moved off. Retired values come from
  `data/constant-history.json`, so the rule is near-zero-false-positive — worked examples
  ($900, $495) and statutory rates (55%, 30%) are never candidates. Per-block annotation was
  rejected: it is opt-in, so a new page would be silently uncovered.

  **The gate needed a second fix to be real.** `gen-history.mjs` wrote `effective_to: null`
  unconditionally and never read the existing file, so every run DISCARDED prior rows — 144
  in-force, zero superseded, and no "what did this used to be" to check against. Added
  `mergeHistory()`, which carries superseded rows forward, closes an in-force row when its
  value or source changes, and keeps an unchanged row verbatim (preserving its original
  `effective_from`, and keeping the generator byte-identical on unchanged stamps). Verified
  idempotent; `check-history` already tolerated superseded rows, so nothing else moved.

  Until a tracked value actually changes the RETIRED rule has nothing to match and the
  checker SAYS SO rather than showing a clean pass — a silently no-op gate is worse than
  none. `scripts/test-schema.mjs` (24 cases) is what proves it fires: it replays the real
  eicalc.ca defect, and an end-to-end run against the repo with a synthetic superseded row
  flagged `benefits/ei/index.html:55: $79,000 is a retired value of ei.repaymentThreshold
  (now 86125)`. Both are hard-failing CI steps.

  Known limitation, deliberate and asserted by a test: bare integers are not tokenised. Only
  `$`-prefixed and `%`-suffixed figures are scanned, because counts (41 rows, 420 hours,
  8 drop-out years) would otherwise collide with any retired small value.

- **Localize the French section (`/fr/`) chrome** (was item 3): done 2026-08-12. Header nav
  (Paie, Revenu supplémentaire, Prestations, Emploi, Propriété, Dates clés) and footer
  (column headings, link labels, tagline, disclaimer) are now French on all three `/fr/`
  pages, with the stray `lang="en"` overrides removed now that the chrome matches the page's
  `fr-CA`. Also fixed a real hreflang bug found in the same pass: `/fr/salaire-net-quebec/`
  and `/payroll/take-home-pay/` carried a reciprocal `hreflang`/toggle pair despite not being
  content-equivalent (Quebec-only vs. all-provinces) — removed on both sides, leaving a plain
  related-calculator link instead. The genuinely correct pair (`/payroll/quebec-income-tax/`
  ↔ `/fr/calculateur-impot-quebec/`) was untouched. Added a sitewide footer `Français` link
  and a homepage card so `/fr/` has more than one inbound link from the English site.
  **PENDING NATIVE-SPEAKER REVIEW still stands** — this pass only touched chrome and linking,
  not the French page copy itself; still have a native Québécois speaker read the content
  before actively promoting the section.

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
