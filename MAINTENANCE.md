# Tax-constant maintenance

Every income-tax / payroll constant on calc-hq.ca — and, since 2026-07-18, every
benefit-program constant too — lives once, with provenance, in
[`data/tax-constants-2026.js`](data/tax-constants-2026.js). Each value carries
`{ value, source_url, last_verified }` plus an optional `cadence` (Rule 4).
`data/rates-2026.js` derives the runtime objects (`FEDERAL`, `CPP`, `EI`, `PROVINCES`,
`ONTARIO_ESA`, `CCB`, `LTT`, `CPP_RETIREMENT`, `EI_PARENTAL`, `QPIP_PARENTAL`) from it and
holds **behaviour only** — so you change a number in **one** place.

Five standing rules keep it honest. Rules 1, 3 and 5 are calendar passes (January, quarterly,
July); Rule 2 is event-driven; Rule 4 is the automated check that tells you which is due.

## Rule 1 — Annual January re-verification

Federal brackets and BPA, the CPP / CPP2 / EI rates and maximums, and **every**
provincial/territorial bracket table and BPA are indexed on **January 1**. Every January:

1. Open each constant's `source_url` and confirm the current value.
2. Update `value` if it changed, and set `last_verified` to today's ISO date — **on every
   value you checked**, even the ones that didn't change (the date is the point).
3. Anything you can't confirm gets `last_verified: "UNVERIFIED — pending Jan audit"`, not
   a date you can't stand behind.

Primary sources: CRA T4032 (federal Chart 1 + each province's Chart 2 + CPP/EI), the CRA
CPP and EI rate/maximum pages, and each province's own finance/statute page. Bracket
ceilings use `Infinity`, which is why the file is a JS module, not JSON.

**Also in the January pass — the Key Dates & Limits constants** (`registeredAccounts` and
`taxDeadlines2026` in `tax-constants-2026.js`, powering `/key-dates-limits/`). These are the
whole point of that section, so they must be current:
- **Contribution limits** — TFSA, RRSP dollar limit, YMPE/YAMPE all sit on one CRA table
  (`SRC.craLimits`, the MP-RRSP-DPSP-TFSA-limits-YMPE page). FHSA ($8,000 / $40,000) and the
  RESP/CESG figures are legislated and rarely move, but re-confirm. TFSA indexes to the nearest
  $500 — watch for the year it finally steps up from $7,000.
- **Tax deadlines** — re-stamp for the NEW tax year each January (rename the block to the new
  year, update every date, and re-check the weekend/holiday roll: a deadline on a Sat/Sun/holiday
  moves to the next business day, which is why 2026 has RRSP → Mar 2 and instalment 1 → Mar 16).
  The two content pages hardcode these figures in prose, and the deadline countdown imports
  `KEY_DATES` — update the constants and both flow through.
- **Benefit payment dates** (`benefitPaymentDates2026` → `BENEFIT_PAYMENT_DATES`, powering
  `/key-dates-limits/ccb-payment-dates/`) — CRA publishes a NEW calendar each year, so re-stamp
  the whole block every January from the CRA "Payment dates for CRA administered benefits and
  credits" page (`SRC.craBenefitDates`): CCB (monthly, ~20th), GST/HST credit, and the Ontario
  Trillium/Canada PRO calendar. Dates shift when the usual day lands on a weekend/holiday (CRA
  pays EARLIER, never later) and December is always early. **Watch the program names** — the
  GST/HST credit was renamed the *Canada Groceries and Essentials Benefit* partway through 2026,
  so the page splits Jan/Apr from Jul/Oct; check whether the old name is still in use.
  NOTE: this page's date tables are STATIC HTML (for crawlability) with the constants used by the
  countdown — update **both** the tables and the constants, or they'll drift.
  **Also re-stamp `cppOasGis`** (added 2026-07-18) — the single Service Canada schedule shared by
  CPP, OAS, GIS, the Allowance and the Allowance for the Survivor, sourced from the
  whole-of-government benefits calendar (`SRC.benefitsCalendar`) rather than the CRA page. It is
  stored ONCE because the CPP and OAS calendars were identical for 2026 and Service Canada
  publishes them as one PDF. **Check that assumption every January** — if the two ever diverge,
  split the constant into separate `cpp` and `oasGis` nodes rather than editing one and assuming
  the other followed.

## Rule 2 — Budget-watch (ongoing, not scheduled)

When a province or territory tables a **mid-year** tax change, verify against the
**enacted statute / the government's own announcement — not the CRA T4032 table.** The
T4032 is published in January and **lags** in-year legislation.

**Worked example — PEI, 2026.** PEI's Bill No. 23 (2026 budget) added a sixth bracket
(over $200,000 @ 20%) and shifted the fifth threshold to $142,520. CRA's T4032-PE still
showed the pre-Bill-23 five-bracket table (top $142,250 @ 19%). We used the **enacted PEI
law** and recorded `source_url` as the PEI finance page, not the CRA table. Do the same
for any future mid-year change: statute first, and note in a comment when the T4032 lags.

## Rule 3 — Quarterly re-verification (GIS / OAS benefits)

The **Guaranteed Income Supplement** (`gis`, powering `/benefits/gis/`) and the **Old Age
Security pension** (`oas`, powering `/benefits/oas/`) are **NOT on the January cycle**. Old
Age Security benefits — the OAS pension, GIS, and the Allowances — re-index to the CPI
**every quarter: January, April, July, and October**. Both blocks must be re-checked at the
start of each quarter and **bumped together**; each carries its own `effectiveQuarter` string
(both currently `July–September 2026`), and both are stamped on-page.

**OAS specifically** (`SRC.oasPayments` / `SRC.oasAmount`) — two figures move quarterly:
`maxMonthly65to74` and `maxMonthly75plus`. The 75+ amount is 10% higher and that relationship
is fixed, so it is a useful sanity check: the ratio must stay exactly 1.1.

**The OAS recovery tax runs on a different clock and must not be bumped quarterly.** The
threshold and both ceilings are set per **July–June recovery period**, keyed to the *previous*
calendar year's income, so those nodes carry `cadence: 'july'` individually and are chased in
the July pass, not the quarterly one:

- `recoveryThreshold`, `fullRecoveryCeiling65to74`, `fullRecoveryCeiling75plus`,
  `recoveryPeriod`, `recoveryIncomeYear` — all from the recovery-period table on
  `SRC.oasRecoveryTax`, which publishes three periods at once. Each July, move to the next row.
- That table's forward row is flagged by Service Canada as an **estimate** from January to
  September and final only from October — so a July update takes an estimate. Re-confirm in
  October.
- `recoveryRate` (15%), the deferral increments and the residency rules are statutory and
  never move on either clock.

- Source: Service Canada "How much you could receive" (`SRC.gis`) publishes the four maxima
  and income cut-offs each quarter. **The detailed per-income rate tables have been retired**
  — the calculator models a linear phase-out between the max and the cut-off, so those two
  numbers per status are what must stay current. GIS never decreases quarter-to-quarter.
- The employment-income exemption ($5,000 + 50% of the next $10,000) and the 65+/OAS
  eligibility rule change only by legislation — re-confirm, but they rarely move.

---

### Quebec — shipped (the inaugural run)

Quebec is now fully wired and live, built in pieces through this system: QPP (not CPP),
QPIP (not federal EI parental), the 16.5% federal abatement, and its own provincial
brackets + BPA — each verified against Revenu Québec / CRA and stamped with `source_url`
and `last_verified` (2026-07-15). The Quebec brackets/BPA index annually and are covered by
the **January** income-tax audit alongside the other jurisdictions.

**Scope boundary (Quebec provincial credits).** Two Quebec-specific items are modelled: the
basic personal amount as a *bundled* credit base — per Revenu Québec (Line 350) Quebec's basic
amount already embeds QPP / QPIP / EI, so those are NOT re-added on top the way they are for
other provinces (`bpaBundlesContributions`) — and, added **2026-07-16**, the **deduction for
workers** (TP-1 line 201): 6% of eligible work income (employment + net business income),
capped at **$1,450** for 2026, subtracted from the Quebec taxable base before bracket tax in
both `calcTakeHome` and `calcSelfEmployed` (Quebec-only; no federal effect). Its 2026 cap
re-indexes each year alongside the brackets — re-verify in the January audit (Revenu Québec
line 201 / the payroll Principal Changes page carry the current cap; the return page lags a
year). Still **not** modelled: all other non-refundable credits (age, living-alone,
dependants, etc.), which are situational rather than near-universal.

## Rule 4 — Cadence tags + the automated checker

As of **2026-07-18** the benefit-program constants (ESA, CCB, LTT, CPP-timing, EI
maternity/parental, QPIP maternity/parental) live in `tax-constants-2026.js` like everything
else — they are no longer inline in `rates-2026.js`. Because they do **not** all follow the
January cycle, every provenance node can carry a `cadence`:

| cadence | meaning | who uses it |
|---|---|---|
| `january` | annual CRA/payroll indexation — **the default** when omitted | Rule 1: brackets, BPAs, CPP/EI, contribution limits, EI/QPIP weekly maxima and MIEs, CPP max at 65 |
| `july` | re-indexed each July on a July–June benefit year | Rule 5: CCB maxima + AFNI thresholds |
| `quarterly` | re-indexed Jan/Apr/Jul/Oct | Rule 3: GIS/OAS, the published CPP average |
| `statutory` | changes only by legislation/by-law — **never stale on a calendar** | Rule 2: ESA, LTT, CCB reduction percentages, CPP/QPP adjustment factors, EI/QPIP weeks and rates |

A block sets a default with `_cadence`; an individual node overrides it with `cadence`. This
matters — e.g. within `ccb` the dollar maxima are `july` but the reduction percentages are
`statutory` (fixed since 2016), so only the maxima are chased each July.

**The checker:** `scripts/check-constants.mjs` walks the whole tree and flags `UNSTAMPED`
(a bare value with no provenance), `NO-SOURCE`, `UNVERIFIED`, and `STALE` (the cadence rolled
over since `last_verified`). Run it at the start of every audit, before touching anything:

```
node scripts/check-constants.mjs                    # or --as-of YYYY-MM-DD, --verbose
```

There is no Node runtime on the build machine, so it is also importable in a browser console
against the dev server: `(await import('/scripts/check-constants.mjs')).report()`.

It exits non-zero when anything is flagged. **As of 2026-07-18 it PASSES with exit 0** —
162 stamped values, 0 issues.

**It is wired into CI** at `.github/workflows/check-constants.yml`, which runs it on every
push to `main`, on pull requests, **on the 1st of every month**, and on manual dispatch. The
report is written to the run's job summary.

The **monthly schedule is the important trigger**, not the push one. `STALE` is time-based:
a value goes stale because a January / July / quarterly boundary passed, not because anyone
edited a file. A push-only gate would never fire for the failure it most exists to catch.
Running on the 1st means the Jan / Apr / Jul / Oct rollovers surface within days, and a
failing scheduled run emails the repo owner.

Two limits to know:
- **It gates the repo, not the deploy.** Cloudflare serves the static assets independently of
  GitHub Actions, so a red run does not stop a push to `main` from going live. To make it a
  true gate, enable branch protection on `main` requiring the `check-constants` check, and
  work through pull requests.
- **The repo intentionally has no `package.json`.** `data/*.js` are ESM, so Node needs
  `{"type":"module"}` to parse them — but committing that to the root risks Cloudflare
  auto-detecting a Node build for what is a pure static-asset deploy. The CI job writes a
  throwaway one into its own checkout instead. If you ever add a real `package.json`, drop
  that step and add `"type": "module"` to it.

**Structural exemptions.** Four leaf names are allowed to be bare values because they are
labels or model flags, not sourceable facts: `name`, `indexation`,
`bpaBundlesContributions`, `includesCanadaEmploymentAmount`. They are listed by exact key in
`STRUCTURAL_EXEMPT` — an allowlist, **not** a blanket "ignore unstamped" switch, and the
report prints how many were exempted so they stay visible.

A second list, `NEVER_EXEMPT`, names the material constants (`bpaCreditRate`,
`healthPremiumMax`, `selfEmployedMultiplier`, `bpa`, `brackets`, …). **The module throws on
import if any key appears in both lists**, so the exemption mechanism can never be widened to
hide a real figure. If you add a new material constant, add it to `NEVER_EXEMPT`.

**Cross-field invariants.** `invariants()` checks relationships a per-value stamp can't:
currently that `bpaCreditRate === brackets[0].rate` for all 13 jurisdictions, since CRA values
non-refundable credits at the lowest rate ("multiply the total on line 17 by the lowest
provincial tax rate", T4032). This is the January failure mode it exists to catch — updating a
bracket table and forgetting the credit rate would mis-state tax for every filer in that
jurisdiction, with both values still looking properly stamped.

## Rule 5 — July re-verification (CCB)

The **Canada child benefit** (`ccb`, powering `/benefits/ccb/`) runs on a **July–June benefit
year** and re-indexes every **July**, using the *previous* calendar year's adjusted family net
income. Each July, re-check `maxUnder6`, `max6to17`, `threshold1`, `threshold2` and the
`benefitYear` / `baseYear` labels. The `tier1Rates` / `tier2Rates` percentages are `statutory`
and do **not** move.

**Use the right source — this cost us a false alarm on 2026-07-18.** Three canada.ca pages
look like they should carry the CCB maxima. Only one does:

- **`SRC.craIndexation` — the CRA indexation chart. USE THIS.** Its "Canada child benefit
  (CCB)" table publishes the base maxima, both thresholds and the base phase-out amounts for
  the *current* year, alongside the indexation rate applied.
- `SRC.ccbSheets` (calculation sheets) — **lags a full benefit year.** On 2026-07-18 the newest
  sheet was still July 2025–June 2026. Do not read the maxima here and do not conclude from its
  absence that the figures are unpublished. It remains the source for `tier2Rates`, which the
  indexation chart does not carry.
- `SRC.ccbHowMuch` — carries the two thresholds but **no longer states the maxima at all**.

**Free cross-check:** the indexation chart's "Base phase out amount" rows must equal
`(threshold2 − threshold1) × tier1Rate` for 1/2/3/4+ children. On 2026-07-18 that reproduced
$3,123 / $6,022 / $8,476 / $10,260 exactly. If it ever doesn't, either a threshold or a
reduction rate is wrong — run it every July.

---

## Redirects — how to move a URL on this site

**Verified working 2026-07-18** against the live site, not assumed. This site is served by
**Cloudflare Workers Static Assets**, not Cloudflare Pages — `wrangler.jsonc` declares an
assets-only Worker (`assets.directory: "./"`, no `main` script), and `calc-hq-ca.pages.dev`
does not resolve. Deploys happen automatically on push to `main`, landing in roughly a minute.

Redirects go in **`_redirects` at the repo root** (the assets directory). One rule per line:

```
/old/path/            /new/path/            301
/old/section/*        /new/section/:splat   301
```

What was confirmed live, with the test rules since removed:

| Behaviour | Result |
|---|---|
| Plain `301` | Works — `301` + correct `Location`, follows to `200` in one hop |
| Wildcard `*` with `:splat` | Works — `/x/contribution-limits/` → `/key-dates-limits/contribution-limits/` |
| Query strings | Preserved across the redirect |
| `_redirects` served publicly? | **No** — a request for `/_redirects` returns 404 |
| Real pages during the test | Unaffected, all `200` |

**Redirects beat real files.** Cloudflare: *"Redirects are always followed, regardless of
whether or not an asset matches the incoming request."* Convenient — you don't have to delete
the old file for the redirect to fire — but it means a careless rule can shadow a live page.
Redirect **from** a path you have actually retired, and never point a rule at itself; there is
no documented loop protection.

**Limits:** 2,000 static rules, 100 dynamic (wildcard/placeholder), 2,100 total, 1,000
characters per line. Past that, use Cloudflare Bulk Redirects.

**Caching caveat when testing.** A 404 fetched before the rule deploys gets cached at the
edge and will keep returning 404 for a while afterwards. Test with a cache-busting query
string (`?cb=123`) or `Cache-Control: no-cache`, and re-test a few times before concluding a
rule is broken — this produced a false negative during the original verification.

---

# AUDIT LOG

## 2026-07-15 — Inaugural full audit (all live jurisdictions + benefits)

First complete pass of the maintenance system: every constant re-checked against primary
sources **from scratch**, ignoring existing code comments and prior verification stamps.
Method — federal/CPP/EI, western (BC/SK/MB), Atlantic+territories, and benefits (CCB/ESA/LTT)
verified in parallel against CRA / provincial-finance / municipal sources; the two known-open
items (ON surtax tier-2, Alberta) and Ontario + Quebec verified directly against the CRA
T4032 and Revenu Québec tables.

**Result: 1 correction, 0 unverified, everything else confirmed.**

### The one correction
- **Newfoundland & Labrador BPA — CORRECTED $11,188 → $13,094.** The code held the **2025**
  value. NL Budget 2026 (Apr 29, 2026) raised the BPA to **$13,094** effective Jan 1, 2026
  (gov.nl.ca Finance "provincial non-refundable credits table"). Caveat kept in code: NL is
  separately phasing toward a **$15,000** exemption, delivered in-year via a prorated higher
  *payroll* BPA from July 2026 — but the amount claimed on the **2026 return** (what an annual
  calculator uses) is $13,094. Regression: only NL take-home moved (+~$166 at $65k); all other
  jurisdictions byte-identical.

### The two flagged-for-scrutiny items — both RESOLVED
- **ON surtax tier-2 threshold: CONFIRMED $7,446** (not $7,307). CRA T4032-ON 2026: surtax is
  20% of basic ON tax over $5,818, plus 36% over $7,446; ON indexing factor 1.9% for 2026.
  $7,307 was the 2025 figure. The open question from July 12 is closed — code was already right.
- **Alberta brackets: CONFIRMED.** BPA $22,769; 8% bracket on the first $60,000 indexed +2.0%
  → $61,200; all upper thresholds match the 2.0% indexation. Code was already right.

### Confirmed as-is (primary source in parentheses)
| Group | Constants | Status |
|---|---|---|
| Federal | brackets (14/20.5/26/29/33 @ 58,523/117,045/181,440/258,482), BPA max $16,452 / min $14,829, CEA base $1,501 | CONFIRMED (CRA current-year brackets; 2026 lowest rate is a clean 14%) |
| CPP / CPP2 | 5.95%, exemption $3,500, YMPE $74,600, max $4,230.45; CPP2 4% / YAMPE $85,000 / $416 | CONFIRMED (CRA CPP rates page) |
| EI | 1.63%, MIE $68,900, max $1,123.07; employer 2.28% / $1,572.30; QC 1.30% / $895.70 | CONFIRMED (CRA EI rates page) |
| Ontario | brackets, BPA $12,989, surtax $5,818@20% + $7,446@36%, health-premium schedule | CONFIRMED (CRA T4032-ON) |
| Quebec | brackets 14/19/24/25.75 @ 54,345/108,680/132,245, BPA $18,952, QPP 6.3% / $4,479.30, QPIP 0.430/0.602/0.764% + MIE $103,000, 16.5% abatement | CONFIRMED (Revenu Québec; verified this same cycle) |
| Alberta | brackets (8% to $61,200 …), BPA $22,769 | CONFIRMED (alberta.ca; +2.0%) |
| BC | 7 brackets, BPA $13,216, tax-reduction base $690 / $25,570 / 3.56% | CONFIRMED (gov.bc.ca) |
| Saskatchewan | brackets, BPA $20,381 | CONFIRMED (SK 2026 structure; gov page 403'd, corroborated via taxtips) |
| Manitoba | brackets $47,000 / $100,000, BPA $15,780 — all FROZEN at 2024 levels for 2026 | CONFIRMED (MB Budget 2025-26 freeze) |
| Nova Scotia | 5 brackets, BPA $11,932 (flat) | CONFIRMED (NS now indexes 1.6%; income-test removed) |
| New Brunswick | 4 brackets, BPA $13,664 | CONFIRMED |
| Newfoundland & Labrador | 8 brackets | CONFIRMED (BPA corrected — see above) |
| PEI | 6-bracket Bill 23 table (effective Jan 1 2026, rolled back from 2027), BPA $15,000 | CONFIRMED (enacted statute; CRA T4032-PE still shows the pre-Bill-23 table — statute governs) |
| Yukon | 5 brackets, federal income-tested BPA $16,452 / $14,829 | CONFIRMED |
| NWT | 4 brackets, BPA $18,198 | CONFIRMED |
| Nunavut | 4 brackets, BPA $19,659 | CONFIRMED |
| CCB (Jul 2026–Jun 2027) | max $8,157 / $6,883, thresholds $38,237 / $82,847, tier rates 7/13.5/19/23% & 3.2/5.7/8/9.5% | CONFIRMED — now OFFICIAL (was derived; CRA published) |
| Ontario ESA severance | 5-yr floor, $2.5M payroll / 50-employee closure, weeks formula, 26-wk cap | CONFIRMED (ontario.ca) |
| LTT | ON provincial bands + $4,000 FTB; Toronto MLTT graduated (Apr 1 2026) + $4,475 FTB | CONFIRMED (ontario.ca; toronto.ca — $4,475 now primary-source confirmed) |

### Watch-outs recorded for future audits
- **BC indexation pauses 2027–2030** (Budget 2026) — BC brackets will NOT move those years; resumes 2031.
- **Manitoba freeze** — brackets + BPA held at 2024 levels; confirm each year whether the freeze is lifted.
- **Saskatchewan** — BPA includes the Affordability Act +$500 (through 2028) on top of indexation; the gov page 403s to automated fetches, so keep a taxtips corroboration on file.
- **PEI** — CRA T4032-PE payroll table and many calculators still surface the old 3-bracket (9.8/13.8/16.7) structure; the enacted 6-bracket statute governs.
- **NL** — the $15,000 exemption phase-in: re-check the 2027 return BPA (it should land at $15,000).
- **CCB** — 2026–27 amounts now official; next re-index is **July 2027**.
