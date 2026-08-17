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

## 2. Page figures vs the pack — an unchecked drift surface

**What:** Constants restated in page HTML — prose, FAQ answers and `application/ld+json`
blocks — are literals, and nothing verifies them against `data/tax-constants-2026.js`. Opened
2026-08-16 with the eicalc.ca port. `benefits/ei/` and `benefits/cpp/` carry the most
January-linked figures, but this is site-wide: `payroll/take-home-pay/` restates the surtax
thresholds, YMPE, MIE and rates the same way.

**Why the obvious fix doesn't work.** `/benefits/ei/` was briefly built to fill every figure
from the pack at runtime, which did eliminate the drift — but it left the SERVER HTML
incomplete: a plain fetch got `capped at $ a week` and two tables with headers and no rows.
Reverted to literals 2026-08-16 to match the rest of the site. Prerendering at build time is
also out: the repo deliberately ships no `package.json` (see the CI workflow header — it
would risk Cloudflare auto-detecting a Node build for a pure static deploy). So the figures
stay literal, and the only way to make them safe is to check them.

**Why it matters:** this is the exact mechanism that rotted eicalc.ca — a figure with no link
to the constant it derives from, going stale silently. Lower severity here (wrong in a search
result, not in a calculation) but the same failure mode, and `check-constants.mjs` structurally
cannot see it because the numbers live in HTML rather than in the pack.

**What a check would take** (roughly 60–90 lines, `scripts/check-schema.mjs`):
1. Walk `**/index.html`, regex out each `application/ld+json` block, `JSON.parse` it. This
   also gives a free JSON-LD validity gate, which nothing currently does.
2. Concatenate the `Question.name` + `acceptedAnswer.text` strings and scan for money and
   percent tokens (`/\$[\d,]+(?:\.\d{2})?|\d+(?:\.\d+)?%/g`).
3. Build the expected set from the pack: for each figure, the formatted forms it may legally
   appear as (`68900` → `$68,900`; `0.0163` → `1.63%`). Formatting variance is the fiddly
   part — decide up front whether `$729` and `$729.00` are both acceptable.
4. Fail on any token that looks like a tracked constant but matches no current pack value.
   Report `file:line`, the stale token, and the expected one.

**The judgement call that makes or breaks it:** a naive "every number in the schema must be
in the pack" rule drowns in false positives — worked-example figures (`$900`, `$495`,
`$9,900`), statutory rates (`55%`, `30%`, `50 cents`, `90%`) and counts (`14`, `45`, `41`,
`420`, `700`) are all legitimately literal. Two workable options:
- **(a) Denylist by value** — only flag tokens matching a *previous* pack value (needs
  `constant-history.json`, which already stores exactly that). Precise, near-zero false
  positives, and catches real staleness by construction. **Recommended.**
- **(b) Explicit annotation** — mark checked figures in the schema (e.g. a sibling HTML
  comment listing the pack keys a block depends on) and verify only those. Simpler logic,
  but it's opt-in, so a new page silently isn't covered.

Option (a) reuses machinery that exists and would have caught the $79,000 threshold the day
the 2025 MIE landed. Add it to the CI workflow as a fifth step alongside `check-redirects`.

**Risk if ignored:** a stale figure in search results and rich snippets, diverging from a
page that itself stays correct — the hardest kind to notice, since the page looks right.

---

---

## Done

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
