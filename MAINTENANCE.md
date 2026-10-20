# Tax-constant maintenance

Every income-tax / payroll constant on calc-hq.ca — and, since 2026-07-18, every
benefit-program constant too — lives once, with provenance, in
[`data/tax-constants-2026.js`](data/tax-constants-2026.js). Each value carries
`{ value, source_url, last_verified }` plus an optional `cadence` (Rule 4).
`data/rates-2026.js` derives the runtime objects (`FEDERAL`, `CPP`, `EI`, `PROVINCES`,
`ONTARIO_ESA`, `CCB`, `LTT`, `CPP_RETIREMENT`, `EI_PARENTAL`, `QPIP_PARENTAL`) from it and
holds **behaviour only** — so you change a number in **one** place.

Seven standing rules keep it honest. Rules 1, 3 and 5 are calendar passes (January, quarterly,
July); Rule 2 is event-driven; Rule 4 is the automated check that tells you which is due; Rule 6
ties the figures quoted in page copy back to the values they restate; Rule 7 says which form each
money calculation follows.

## Rule 1 — Annual January re-verification

Federal brackets and BPA, the CPP / CPP2 / EI rates and maximums, and **every**
provincial/territorial bracket table and BPA are indexed on **January 1**. Every January:

1. Open each constant's `source_url` and confirm the current value.
2. Update `value` if it changed, and set `last_verified` to today's ISO date — **on every
   value you checked**, even the ones that didn't change (the date is the point).
3. Anything you can't confirm gets `last_verified: "UNVERIFIED — pending Jan audit"`, not
   a date you can't stand behind.
4. **A stamped value that looks like a typo is checked against the CURRENT year's primary
   source before anyone changes it.** Read the row for the tax year the file covers, not the
   nearest familiar number, and note which edition you read: CRA reissues T4032 mid-year (BC,
   NL and PE all had "Effective July 1, 2026" editions), and a January edition can predate a
   budget. The BC lowest rate went wrong this way on 2026-07-23 — the correct 2026 value
   (5.60%) looked like a dropped zero, and last year's value (5.06%) looked right.
5. **If any contribution or premium rate changed** (CPP, CPP2, QPP, EI, Quebec EI, QPIP), re-run
   the half-cent check in Rule 7 for the whole family before shipping. A function that was clean
   last year is clean only because of last year's rate.

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
  The six per-benefit pages added 2026-10-20 (`/key-dates-limits/{canada-child-benefit,
  gst-hst-credit,cpp,oas-gis,ontario-trillium-benefit,ei}-payment-dates/`) do NOT have that
  problem: their tables are written from the same constants by `scripts/sync-payment-dates.mjs`,
  and its `--check` runs in CI. After re-stamping, run it and commit the regenerated pages. Their
  prose also restates a few 2026 dates in words (the CCB's June 19 / September 18 / December 11,
  the OTB's January 9 / May 8 / October 9, the GST/CGEB quarter dates, the FAQ date lists) —
  rewrite those by hand in the January pass. The rule figures they quote ($240, $50, $500, $2,
  25%, 50%) are stamped in the same block and registered, so the prose gate catches those.
  **Also re-stamp `cppOasGis`** (added 2026-07-18) — the single Service Canada schedule shared by
  CPP, OAS, GIS, the Allowance and the Allowance for the Survivor, sourced from the
  whole-of-government benefits calendar (`SRC.benefitsCalendar`) rather than the CRA page. It is
  stored ONCE because the CPP and OAS calendars were identical for 2026 and Service Canada
  publishes them as one PDF. **Check that assumption every January** — if the two ever diverge,
  split the constant into separate `cpp` and `oasGis` nodes rather than editing one and assuming
  the other followed.

**Also in the January pass — the RDSP grant/bond thresholds** (`rdsp`, powering `/benefits/rdsp/`,
added 2026-07-26). Three income thresholds are indexed annually by the CRA and must be re-read
each January from `SRC.rdspHowMuch`:
- `grantThreshold` — the 300%/200% vs 100% matching boundary
- `bondZeroThreshold` — income at which the bond reaches nil
- `bondFullThreshold` — income up to which the full bond is paid

Bump `currentYear` at the same time; it is the tripwire that goes STALE each January to force
this check. Everything else in the block (match rates, $3,500/$1,000 annual maxima, $70,000 /
$20,000 / $200,000 lifetime limits, the $10,500 / $11,000 carry-forward ceilings, the age-49
cut-off) is `statutory` — EARNED, not assumed: archived captures declaring 2022 through 2026 all
state identical figures, while the three thresholds moved every year.

**Read the source's declared year, not the URL.** `SRC.rdspHowMuch` states "For the 20XX calendar
year" in-text; attribute values to that. It also ships the government's own estimator as inline
JavaScript (`const phaseOut = …, firstThreshold = …, secondThreshold = …`), which is the most
reliable machine-readable form of the thresholds and tier logic — read it as well as the prose.

**Three separate invariants guard the linkages** to figures stamped elsewhere in this file:
`rdsp.grantThreshold === federal.brackets[1].max`, `rdsp.bondZeroThreshold ===
federal.brackets[0].max`, `rdsp.bondFullThreshold === ccb.threshold1`. They are separate so a
failure names which linkage broke. **If one fires, verify against the Canada Disability Savings
Act — do NOT edit one value to match the other.** They are separately sourced on purpose, and
syncing them silently destroys the only signal that a linkage changed.

**Two things deliberately NOT modelled**, both surfaced on-page rather than guessed:
- **Carry-forward** (10 prior DTC-approved years, raising a single year's ceiling to $10,500 /
  $11,000). Not derivable from anything a calculator can ask — it needs DTC status, income,
  contributions and grant paid in each of ten years. canada.ca's own estimator excludes it too,
  and ESDC mails the real figure on a Statement of Entitlement each February. Excluding it is
  exact for anyone with no unused room and understates for everyone else; it never overstates.
- **The bond's age cut-off.** canada.ca states the December-31-of-age-49 cut-off only for the
  GRANT. A timeboxed check of the Act did not find the bond's stated (s.7 gives the 10-year
  window and the $20,000 cap, no age). The engine applies the same boundary to the bond as a
  documented assumption flagged by `bondEndAgeIsAssumption`, and the page says so. If you ever
  find the citation, promote it and drop the flag.

The **bond phase-out between the two thresholds is the published estimator's straight line**, not
a statutory quotation — canada.ca's prose says only that the amount "decreases". Our engine
reproduces the government estimator exactly (verified: zero divergence across 63 income ×
contribution combinations), and the page states that this is what it is doing.

## Rule 2 — Budget-watch (ongoing, not scheduled)

When a province or territory tables a **mid-year** tax change, verify against the
**enacted statute / the government's own announcement — not the CRA T4032 table.** The
January T4032 **lags** in-year legislation. CRA may later issue an "Effective July 1"
edition, but its mid-year rates are **prorated** for July–December withholding and are
never the annual rate (see Rule 1 step 4).

**Worked example — PEI, 2026.** PEI's Bill No. 23 (2026 budget) added a sixth bracket
(over $200,000 @ 20%) and shifted the fifth threshold to $142,520. CRA's January T4032-PE
showed the pre-Bill-23 five-bracket table (top $142,250 @ 19%); its July 1, 2026 edition
caught up but withholds at a prorated 21% above $200,000. We store the **enacted** 20% and
cite the PEI Income Tax Act itself (`SRC.peAct`, s.7 and s.9) — re-verified 2026-10-18, after
PEI's rates page moved behind a bot-check. Do the same for any future mid-year change:
statute first, and note in a comment when the T4032 lags or prorates.

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
- `gis.employmentExemption` is `cadence: 'statutory'` (since 2026-10-03), so it never goes stale
  on the calendar. No canada.ca page states it; it cites the Old Age Security Act itself
  (`SRC.oasActS2`, s. 2 "income", para. (b.1)), quoted in full beside the leaf. **If the Act is
  amended, re-read s. 2 and re-check the value** — the "last amended" date at the top of the
  laws-lois.justice.gc.ca page is the thing to watch (2025-10-01 when stamped).

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

### Also on the July cycle — the CHILD disability benefit (`cdb`, added 2026-07-25)

The **child disability benefit** (`cdb`, powering `/benefits/cdb/`) is a CCB supplement and runs
on the **same July–June benefit year**, so it is chased in the same July pass. Re-check
`years.y<current>` (`maxPerChild`, `threshold`, the `benefitYear` / `baseYear` labels) and bump
`currentBenefitYearStart` — that node is the tripwire that goes STALE each July to prompt adding
the new year. Closed years are `statutory` and must not be edited.

**Name collision — confirm this every time.** "CDB" is *also* the adult **Canada Disability
Benefit**, a separate working-age program with its own estimator. Our `cdb` block is the
**CHILD** benefit only. Check the page title before reading any figure off it.

- **Source:** `SRC.cdb` states the maximum, the threshold and both rates in one paragraph, and
  **declares its own benefit period** ("For the period of July X to June Y") — attribute values
  to *that* stated period, never to the URL or the retrieval date. The indexation chart's own
  **"Child disability benefit (CDB)"** section corroborates the maximum and threshold, and its
  `YYYY` column maps to the **July YYYY–June YYYY+1** benefit year (verified across 2023–2026
  against archived captures of `SRC.cdb`).
- **The reduction rates (3.2% / 5.7%) are `statutory` — and that was EARNED, not assumed.**
  Archived captures declaring four different benefit years (Jul2023 → Jul2026) all state the same
  two rates. They are **not** on the indexation chart, so if CRA ever restates them it will only
  show on `SRC.cdb`.
- **Never point `cdb` at the `ccb` nodes.** Its reduction is **single-tier with only two rate
  brackets** (one child / two *or more*), where `ccb.tier2Rates` has four (8% at three children).
  Reusing the CCB array would overstate the reduction for families with 3+ approved children.
  Note also that "eligible children" means **DTC-approved** children, not all children.
- **Invariant:** `invariants()` asserts `cdb.years.y<current>.threshold === ccb.threshold2` — the
  two figures have coincided in every published year but are published separately, so this
  catches a future divergence instead of assuming it away. It compares **only when both blocks
  describe the same benefit year**, so a July window where one is updated before the other does
  not produce a false alarm.

---

## Rule 6 — Prose figures are registered, and the registry is gated

Page copy restates figures as literals — there is no runtime fill — so a value can be
re-verified, re-stamped and pass every other gate while the sentence quoting it still shows
the old number. That happened on 2026-10-03: the OAS/GIS/CPP calculators ran on the new
quarter while their prose and FAQ schema quoted the old one, and CI was green. check-constants
proves a value is cited and in date; check-history proves the audit trail is kept; check-schema
only catches a JSON-LD figure after the pack is on record as having moved off it. None of them
compares a figure in the copy with the value it is supposed to equal.

**The registry:** [`data/prose-figures.json`](data/prose-figures.json). `pages` lists the
in-scope pages; `figures` has one entry per quoted figure, per surface:

```json
{ "page": "/benefits/oas/", "surface": "main",
  "anchor": "the maximum is {} a month at ages 65 to 74",
  "source": { "const": "oas.maxMonthly65to74" }, "format": "exact" }
```

- `surface` — `main` (the visible `<main>` text) or `jsonld` (every string in the page's
  `application/ld+json`). A FAQ answer is normally registered twice, once per surface, because
  the two are worded differently.
- `anchor` — the exact surrounding phrase, as the normalised text reads (inline tags such as
  `<strong>` vanish, other tags become one space, whitespace collapses). `{}` marks the figure;
  `{*}` matches any other figure inside the phrase, so a neighbouring cell in a table row can
  drift without hiding this one. It must match **exactly once** on that surface.
- `source` — `{"const": "<path>"}` for a stamped leaf as-is (the path steps through `.value`,
  e.g. `gis.single.maxMonthly`), or `{"engine": "<expression>"}` for a derived figure, written
  with the fixed inputs the prose states, e.g.
  `"OAS.maxMonthly65to74 * OAS.deferralFactor(70)"` or `"GIS.estimate('single', 9000).monthly"`.
  Expressions see every export of `data/rates-2026.js` and `assets/js/tax-engine.js`, plus `TC`.
  Use the page's own calculator functions so the prose and the calculator cannot disagree.
- `format` — `exact` (to the cent), `round:N` (copy rounds to the nearest N: "about $8,300" is
  `round:100`), `percent` (source is a fraction, 0.0595 → 5.95%) or `percent:D` (rounded to D
  decimals).

**The gate:** `scripts/check-prose-figures.mjs`, in CI straight after the history check. It
fails on `MISMATCH` (figure ≠ source after the format rule), `MISSING` (anchor gone — so
rewritten copy cannot silently drop out of the check), `AMBIGUOUS` (anchor matches twice),
`KIND` (a % where a dollar figure is expected, or the reverse), `CONFIG`, and on its own
built-in self-test, which proves each of those still fires.

```
node scripts/check-prose-figures.mjs          # --verbose lists every passing figure
```

**Adding a figure.** Any new figure in page copy that restates a stamped constant — directly
or through a calculation — **must be registered in the same change that adds it.** Write the
sentence, copy the phrase around the figure from the normalised text, add the entry, run the
script. If you change a constant, the script tells you every sentence that now disagrees; fix
the copy, never the registry entry, unless the sentence genuinely no longer restates that value.
If you rewrite a sentence, update its anchor in the same commit.

**The ratchet.** Every `$` / `%` figure on an in-scope page that no entry covers is written to
`data/prose-figures-unregistered.txt` and counted as a warning. Version 1 does not fail on it.
Burn it down by registering what restates a constant. The rest of the list is worked-example
inputs, counts and other literals, which have nothing to check against. Adding a page to
`pages` puts all of its figures on the list.

---

## Rule 7 — Each calculation follows its governing form

Every contribution and premium has two authorities: a year-end form that fixes the amount owed
for the year, and a payroll formula that fixes what comes off each cheque. They round at different
stages, so no single rounding rule covers both. Three rules follow:

- **Annual figures follow the year-end forms.** The engine works in annual amounts, so every
  figure it returns is the year-end form's figure.
- **Per-cheque figures follow the payroll formulas.** The engine has no per-cheque arithmetic —
  the pages divide the annual figure by 12, 24, 26 or 52 — so payroll and the site part company
  here, by cents.
- **Where a form is silent on a half cent, the figure is left unrounded.** We don't choose a rule
  the form doesn't state.

| Calculation | Annual — governs the engine | Per cheque |
|---|---|---|
| CPP / CPP2, employee | Schedule 8 Part 3, lines 11, 12, 22 | T4127 ch. 6 |
| CPP / CPP2, self-employed | Schedule 8 Part 4, lines 10–17 | — |
| QPP, employee | Schedule U Part B | TP-1015.F-V §3.1 |
| QPP, self-employed | Schedule U Part C, lines 48, 93, 99–103 | — |
| EI and Quebec EI, employee | T2204 lines 10–11 (required premium) | T4127 ch. 7 |
| EI, self-employed opt-in | Schedule 13 lines 9–10 | — |
| QPIP, employee | not yet read | TP-1015.F-V §4.1 |
| QPIP, self-employed | Schedule R line 24 | — |

Editions read 2026-10-18: Schedule 8, T2204 and Schedule 13 for T1-2025; Schedules U and R
2025-12; T4127 122nd edition (January 2026 — the July 123rd edition says the CPP and EI formulas
are unchanged); TP-1015.F-V 2026-01. Re-read each one when its new edition comes out.

**What the forms say about rounding.** The payroll formulas are explicit: each cheque's
contribution or premium rounds half up at the third decimal, and the per-period CPP/QPP
exemption is truncated ($3,500 ÷ 52 = $67.30). The year-end forms say only that amounts carried
to the return are entered "in dollars and cents". None states how to round an exact half cent,
and none says whether intermediate lines are rounded. So `calcCPP` (CPP, CPP2, QPP) and
`calcQPIP` multiply unrounded, and stay that way until a form says otherwise. It matters:
Schedule 8 line 15 for $20,750 of self-employment income is exactly $853.875, and with the EI
opt-in, rounding it up shows NT tax of $9 while rounding it down shows $10. That isn't the
site's call. The self-employed total is line 14 — line 10 plus line 13 — never twice a rounded
employee share: $2,052.75 at $20,750, not $2,052.76.

**EI — the one rounded calculation.** `calcEI` rounds through `centsOf()`, which scales the
amount to whole cents and the rate to a whole number (× 10⁷), so the product is exact; it throws
on a rate with more than seven decimals rather than truncating it. The reason is a float
artefact: 1.63% is stored as 0.016299999999999998…, so a premium that is exactly a whole number
of cents can come out a hair under. On a $45,000 salary the required premium is exactly $733.50;
the float gave 733.4999… and production showed **$733** — also at $5,000, $15,000, $25,000 and
$55,000 — while the hand-written table on `/payroll/self-employed-tax/` said $734. Fixed
2026-10-18 in `ff06cf6`, and kept the same day as T2204's required premium. The table cell is
registered and fails against the old engine. `centsOf()` also rounds a true half cent up, which
T2204 doesn't state: at every whole-dollar income ending in 50, 1.63% lands on one ($20,750 ×
1.63% = $338.225 → $338.23). That is the one place the site has chosen a half-cent rule, and it
was a decision, not an oversight.

**The annual figure is not what payroll withholds.** The annual EI figure is the required
premium. Withholding rounds every cheque, so the year's total moves with pay frequency: at
$45,000 it is $733.44 semi-monthly, $733.46 biweekly, $733.56 monthly and $733.72 weekly,
against $733.50 required. On a steady salary the gap is at most half a cent per cheque — 26¢ a
year when paid weekly. T2204 credits the lesser of withheld and required and refunds an
overpayment only above $1, so these cents are never reconciled. CPP moves the same way: $2,469.22
biweekly to $2,469.48 weekly, against $2,469.25 required on Schedule 8.

**The check, whenever a rate changes** (Rule 1, step 5). For each function, compare the engine
with exact decimal arithmetic on its governing form's lines (Python `decimal`; unrounded for
`calcCPP` and `calcQPIP`, half up to the cent for `calcEI`) at every whole-dollar income from $0
to $200,000, at whole-dollar display and at the cent, including the per-cheque splits (÷ 12,
24, 26, 52). A mismatch at whole-dollar display is a live bug of the EI kind; with 2026 rates
there are none (CPP, QPP, both ×1 and ×2, and both QPIP rates, rechecked 2026-10-18). Before
shipping any rounding change, name the form line that justifies it, diff the engine across all
13 jurisdictions and account for every figure that moves.
## Tax-bracket pages (`/tax-brackets/`)

The bracket tables, the combined marginal-rate table, the personal-amount table, and each
page's `<title>`, meta description, og tags and `<h1>` are **generated**: `scripts/sync-tax-brackets.mjs`
rewrites every region between `<!-- tb:NAME:start -->` and `<!-- tb:NAME:end -->` from
`tax-constants-2026.js` and the engine. The marginal table is found by running the engine
(`calcIncomeTax`) across the income range — never by adding rates — so a surtax, a premium
ramp or a phase-out appears because the engine charges it. Never hand-edit a `tb:` region.

```
node scripts/sync-tax-brackets.mjs           # regenerate every listed page
node scripts/sync-tax-brackets.mjs --check   # CI: fail if a page differs from what it would write
```

`check-prose-figures` skips `tb:` regions (this script guards them); the prose around them is
registered in `data/prose-figures.json` like any other page.

**Every January**, after the constants are re-stamped: run the script, then **read the diff of
each marginal-rate table** — a new or vanished row means a threshold moved relative to another,
and the prose that describes those rows (surtax start, Health Premium ramps) must be re-read.
Then run `check-prose-figures`, which names every sentence whose figure moved. The year in the
generated head and `<h1>` follows `TAX_YEAR`; the year in the FAQ ("When do the new tax
brackets take effect?") and its JSON-LD twin is hand-written and must be bumped.

The Ontario tax reduction is modelled for the basic amount only, so the Ontario marginal table
runs from $0. The per-dependant amounts are not modelled, so its low bands are for a filer with
no dependants.

---

## Open item — orphaned in-force history rows

`data/constant-history.json` holds a row only for leaves whose cadence has a derivable period
start, so every `statutory` leaf is left out (`scripts/gen-history.mjs`). When a leaf that already
has a row is re-tagged `statutory`, gen-history stops emitting its key, and `mergeHistory()`
carries the old row forward verbatim, **still marked in force** (`effective_to: null`) and still
carrying the source and cadence the leaf no longer has. check-history never sees it, because it
checks only the keys gen-history emits. The run reports it as `orphanKeys`.

**The one case so far:** `gis.employmentExemption`, re-tagged `statutory` and re-sourced to the
OAS Act on 2026-10-03 (Rule 3). Its row still reads quarterly, canada.ca, in force from
2026-07-01. The value ($5,000 + 50% of the next $10,000) has not changed. **Left as it is on
purpose (2026-10-19), until one of the options below is chosen.**

**Don't close the row by hand.** Setting `effective_to` tells check-schema that $5,000, $10,000 and
50% are retired values, and it flags them wherever page schema still quotes them. Tried
2026-10-19: 8 false `RETIRED` hits across four pages (`/benefits/gis/`, `/benefits/ccb/`,
`/business/markup/`, `/payroll/pay-raise/`), with check-history still passing. The value is
current; only the row's place in the history ended, and the file has no way to say that.

Two options, neither chosen:

- **A marker for rows that left the history with their value unchanged** — e.g. close the row and
  record why, with check-schema taught to leave such closures out of its retired set. This keeps
  statutory leaves out of the file as now. It needs a row-format change in gen-history,
  check-history and check-schema, and a rule for which date closes the row.
- **Let statutory leaves into the history.** Every stamped leaf gets a row and orphaning on
  re-tag stops happening. The cost is an `effective_from` for leaves whose period start isn't
  derivable (today that is why they're excluded), and ~224 new rows.

Either way, re-check `orphanKeys` in the gen-history report after any cadence change.

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

## Partner-accountant lead form

The site's one server-side piece. A visitor on a calculator page can ask the partner
accountant (Elliott Accounting Group Inc.) to contact them; calc-hq.ca is paid per confirmed
close.

**Path of a lead.** Form (`assets/js/lead-block.js`) → `POST /api/lead` on the Worker
(`worker/index.js`, the only path it runs on — `run_worker_first: ["/api/*"]`) → the Google
Apps Script web app bound to Chad's "calc-hq leads" Sheet (`worker/apps-script/Code.gs`). The
script **stores the row first, then emails**: the partner gets non-test leads that have a
partner; the owner gets a copy of every lead. A mail failure leaves the row in place with
`email_failed` ticked — resend those by hand.

**What is never collected.** Calculator inputs (income, hours, amounts). The form reads only
the calculator's province dropdown, and only to pre-fill its own. An untouched default
(Ontario) is not treated as a choice.

**Provinces with no partner** (`NO_PARTNER_PROVINCES` in `assets/js/lead-config.js` — Quebec
today) record the province, the page and the time only. The form hides every personal field
and the consent box, and the Worker discards personal fields if they are sent anyway. When a
Quebec partner signs, remove `QC` from that list and run the sync script.

**One template, generated into the pages.** The block is static HTML in each page (so no
layout shift), written by `scripts/sync-lead-block.mjs` from its `LEAD_PAGES` list and
`lead-config.js`. Never hand-edit it in a page.

```
node scripts/sync-lead-block.mjs           # rewrite every listed page
node scripts/sync-lead-block.mjs --check   # fail if any page has drifted from the template
```

Deliberately without a block: hubs, home, about/contact/privacy/disclaimer/FAQ, key-dates,
severance, ESA termination, the `/fr/` pages, and `/benefits/gis/` (a low-income seniors'
benefit — a paid referral pitch is the wrong fit). **Deferred:** `/employment-standards/vacation-pay/`
gets the compact block in its own commit once Search Console shows "URL is on Google".

**Changing the consent wording.** Edit `CONSENT_TEXT`, bump `CONSENT_VERSION` (both in
`lead-config.js`), run the sync script. The Worker refuses any other version (the visitor is
asked to reload), and each row stores the version its sender agreed to. Update the privacy
policy's "partner-accountant form" section if the substance changes.

**Config and secrets.** Nothing secret is in this repo — it is public, and its root is the
assets directory. `.assetsignore` keeps the git directory, docs, config and `worker/` off the
site, but anything else committed here is served, so a secret never goes in a repo file.

| Name | Where | What |
|---|---|---|
| `ALLOWED_ORIGINS` | `wrangler.jsonc` vars | origins allowed to post (`https://calc-hq.ca`) |
| `LEAD_RATE_LIMITER` | `wrangler.jsonc` ratelimits | 5 submissions per minute per IP |
| `LEADS_WEBHOOK_URL` | Cloudflare secret | the Apps Script web app `/exec` URL |
| `LEADS_WEBHOOK_SECRET` | Cloudflare secret | must equal the script's `SHARED_SECRET` property |
| `LEAD_TEST_TOKEN` | Cloudflare secret | marks a lead as a test (owner-only email) |
| `LEAD_HEALTH_TOKEN` | Cloudflare secret **and** GitHub Actions secret (same value) | opens `/api/lead/health` only |
| `SHARED_SECRET`, `OWNER_EMAIL`, `PARTNER_EMAIL` | Apps Script script properties | as named |

Local copies of the generated values live in `~/.calc-hq/lead-secrets.env` (mode 600, outside
the repo). Set a Cloudflare secret with
`wrangler secret put NAME < <(sed -n 's/^NAME=//p' ~/.calc-hq/lead-secrets.env)`.

**What wiped the secrets on launch day, and why it can't recur by itself.** Secrets are
bound to Worker *versions*. On an **assets-only** Worker (no `main` script — this site before
the lead form), a deploy produces a version with no secrets: the `.assetsignore` deploy
(`ce0eb3c`) did exactly that, and the merge deploy (`70fb7ed`) then inherited the empty state,
so the live form failed. On a Worker **with** a script, a plain `wrangler deploy` keeps them —
Cloudflare's docs say "secrets are never deleted by a deployment", and a probe on two
throwaway Workers (wrangler 4.151.1, 2026-10-16) confirmed it: the script Worker kept its
secret across a redeploy, the assets-only one lost it. `--keep-vars` is not the fix; it only
protects plain vars. **If `main` is ever removed from `wrangler.jsonc`, every secret goes with
the next deploy.**

**The alarm: `.github/workflows/lead-health.yml`.** Hourly, and after every push to `main`
once Cloudflare's build for that commit has finished, it runs `scripts/check-lead-health.sh`:
the Worker answers on `/api/lead`, a block page still loads the form script, and
`/api/lead/health` (with `LEAD_HEALTH_TOKEN`) answers `{"ok":true}` — which needs both webhook
secrets bound, the Apps Script answering, and the shared secret accepted. It creates no lead.
A failing run emails the repo owner and names the cause (token refused / secrets missing /
shared secret rejected / Apps Script unreachable). Run it by hand any time with
`LEAD_HEALTH_TOKEN=… scripts/check-lead-health.sh`. GitHub pauses scheduled workflows after 60
days without a commit; re-enable it from the Actions tab if so.

**A red "Wait for Cloudflare" step is not always the commit.** On 2026-10-17 the build for
`1a16bea` sat at "Initializing build environment" for five minutes, then ended "Build failed
to initialize and was timed out" — Cloudflare never started a container, never cloned, never
ran `npx wrangler deploy`. Nothing was wrong with the commit, and the fix is **Retry build**
(Cloudflare → Workers & Pages → calc-hq-ca → Deployments → the failed build), not debugging
the code; the retry succeeded in 26 seconds. While a build is failed the site keeps serving
the previous version, so visitors are unaffected — but new Worker code is not live. After the
retry: confirm the four secrets are still bound on the new active version, then open the red
lead-health run and click **Re-run jobs** (that is how #8 went green).

What it does **not** catch: a failing email (the row is still saved, with `email_failed`
ticked — look for it in the Sheet), the browser side of the form breaking while the server
side is fine, and the partner's own inbox.

**Standing rule — spot check, not every push.** Proven 2026-10-16: the git deploy of `fb8ed73`
(version `f1209274`) kept all three secrets and a live test lead went through, so script
deploys are safe and the alarm covers each push. Send a live test lead through the real form
(`#lead_test=<LEAD_TEST_TOKEN>` on a block page; its row reads back with the right province and
`is_test`, then delete it) after any change to the form, the Worker or the Apps Script, and
otherwise once a month. Rotate `LEAD_TEST_TOKEN` afterwards if its value was shown anywhere.
If the alarm or a spot check fails, check the active version's bindings (`wrangler
deployments list --name calc-hq-ca`, then `wrangler versions view <id> --name calc-hq-ca
--json`), re-set what is missing from `~/.calc-hq/lead-secrets.env` with `wrangler secret
bulk`, and run the check again. If the webhook secrets are missing, `/api/lead` answers 503 and
the form shows its generic "didn't go through" message.

**The Apps Script side** is driven by `worker/apps-script/deploy.sh` (clasp 3.4.1, logged in as
the Google account that owns the Sheet; its working copy is `~/.calc-hq/apps-script/`):

```
worker/apps-script/deploy.sh create                          # new Sheet + bound script
OWNER_EMAIL=… worker/apps-script/deploy.sh push-config       # code + temporary Config.gs
#   → open the script, run setup() once, approve (Sheets + send mail as you)
worker/apps-script/deploy.sh push                            # removes Config.gs remotely
worker/apps-script/deploy.sh deploy                          # web app; records the /exec URL
```

After editing `Code.gs`, run `push` then `deploy`. `deploy` updates the existing deployment
in place, so the `/exec` URL — and the Cloudflare secret — never change.

**Testing.**
- **Locally:** `node worker/test/mock-apps-script.mjs` runs the real `Code.gs` against an
  in-memory Sheet and a MailApp that records instead of sending. Point `.dev.vars`
  (gitignored) at it: `LEADS_WEBHOOK_URL=http://127.0.0.1:8799/exec`,
  `LEADS_WEBHOOK_SECRET=local-test-secret`, `LEAD_TEST_TOKEN=local-test-token`,
  `ALLOWED_ORIGINS=http://localhost:8788`. `LEAD_TEST_MODE=1` marks every lead as a test.
  Restart `wrangler dev` after changing `.dev.vars`.
- **Locally against the real Sheet:** run `wrangler dev --port 8792 --env-file
  ~/.calc-hq/dev-live.env --persist-to ~/.calc-hq/wrangler-state` (the `wrangler-live-sheet`
  launch config), and move `.dev.vars` aside first so it can't override the env file.
  `--persist-to` matters: by default wrangler writes its request traces into `.wrangler/`
  inside the repo, which is also the watched assets directory, so every request restarts
  the server. The mock answers in milliseconds and survives that; the real Apps Script
  takes seconds and gets cut off ("Your worker restarted mid-request").
- **Live:** open any block page with `#lead_test=<LEAD_TEST_TOKEN>` in the address bar. That
  lead is flagged `is_test` and emailed to the owner only; a wrong token is refused, never
  sent as a real lead. `GET`/`DELETE /api/lead/test?id=L-XXXXXX` with
  `Authorization: Bearer <LEAD_TEST_TOKEN>` reads or deletes it — the script refuses any row
  not marked `is_test`.

**Rotating a secret.** Generate a new value, put it in `~/.calc-hq/lead-secrets.env`,
`wrangler secret put` it, and for `LEADS_WEBHOOK_SECRET` also change the script's
`SHARED_SECRET` property (Project Settings → Script properties). Leads fail with a 502 until
both sides match, so change them back to back.

---

# AUDIT LOG

## 2026-10-20 — Five unmodelled rules stamped: MB's BPA phase-out and family tax benefit, four low-income reductions

**Found** building the tax-bracket pages: the engine charged MB, NL, NB, NS and PE on brackets and
BPA alone, so MB tax was under-stated at $200k+ and over-stated at low incomes, and NL/NB/NS/PE tax
over-stated for low-income single filers. No constant was wrong; five rules were missing.

**Stamped** (single-filer parts only; spouse, dependant, child and age add-ons need inputs the
calculators don't collect, and the pages say so):

| Leaf | 2026 value | Source | How the 2026 figure was reached |
|---|---|---|---|
| `provinces.MB.bpaPhaseOut` | $15,780 → $0 over $200k–$400k net income | CRA T4127 Jan 2026 (`SRC.mbBpa`); gov.mb.ca credits page; Worksheet MB428 2025 | read directly |
| `provinces.MB.familyTaxBenefit` | $2,065 − 9% of income, valued at 10.8% | Income Tax Act C.C.S.M. c. I10 s.4.6(16.1), current to Oct 16, 2026 (`SRC.mbAct`) | read directly; not indexed |
| `provinces.NL.taxReduction` | $842 − 16% over $24,191 | NLR 18/26 s.3(b) (`SRC.nlLitrReg`); Income Tax Act, 2000 s.21.1, s.6.1 | base read directly; **threshold derived**: 2025's $23,928 × 1.011 (NL's 2026 factor, CRA T4032NL). s.6.1 chains the unrounded figure, so it can be $1 off |
| `provinces.NB.taxReduction` | $818 − 3% over $22,358 | Income Tax Act s.49.1, s.16.1 (`SRC.nbAct`) | **derived**: the s.16.1 CPI chain from the 2022 $19,177 reproduces gnb.ca's 2023–25 thresholds, then NB's 2.0% for 2026; base = ⌈9.4% × (threshold − BPA)⌉ per s.49.1(2)(a), which also gives 2025's $802 |
| `provinces.NS.taxReduction` | $300 − 5% over $15,000 | Income Tax Act s.35(4), current to Sept 3, 2026 (`SRC.nsAct`) | read directly; not on NS's indexation list |
| `provinces.PE.taxReduction` | $350 − 5% over $23,000 | Income Tax Act s.32(2), current to May 29, 2026 (`SRC.peAct`) | read directly (2025: $22,650) |

**January 2027:** re-stamp NL and NB from the 2026 NL428 and NB428 the moment CRA publishes them —
those two thresholds (and NB's base) are derivations, not published figures. A new invariant ties
NB's base to its threshold, BPA and lowest rate, and another ties every `bpaPhaseOut.max` to its
`bpa`, so a January update that moves one input alone fails the check.

**Impact (engine, salary, before → after):** MB +$426 at $250k, +$1,278 at $350k, +$1,704 from
$400k; −$29 at $20k. NL up to −$747 (at $25k), NB up to −$745 (at $25k), NS up to −$188 (at $15k),
PE up to −$350 (at $20k). The other eight jurisdictions are byte-identical across every engine
entry point at every $250 from $0 to $600,000.

**Not fixed, noticed in passing:** the structural `indexation` field reads 0.02 for NL and 0.021 for
NS, but CRA's T4032NL gives NL 1.1% for 2026 and novascotia.ca gives NS 1.6%. Nothing in the
engine reads the field; it is documentation that is wrong.

## 2026-10-17 — BC lowest rate restored to 5.60% (the 2026-07-23 "correction" was the error)

**Found** while cross-checking all 14 bracket sets for the tax-bracket pages. `provinces.BC
.brackets[0].rate` and `provinces.BC.bpaCreditRate` held **0.0506**; the 2026 rate is **5.60%**.

**Verified 2026-10-17 against both primary sources, which agree:**
- gov.bc.ca personal income tax rates ("Last updated on April 17, 2026"): 2026 tax year
  "$0 to $50,363 — **5.60%**"; 2025 tax year "$0 to $49,279 — 5.06%".
- CRA T4032BC **Effective July 1, 2026**: "For 2026 and subsequent years, the lowest personal
  tax rate is increased from 5.06% to 5.60%." It withholds at a prorated **6.14%** from July so
  the year averages 5.60% — a payroll device, not the annual rate. The same notice confirms the
  $690 BC tax reduction this file already held.
- CRA T4032BC **Effective January 1, 2026** still says 5.06% (Chart 2: 0.0506; line 18 "5.06% ×
  0.0506") — it predates BC Budget 2026 (17 Feb 2026). That superseded edition, plus the 2025
  row on gov.bc.ca (note its $49,279 threshold, not 2026's $50,363), is what the 2026-07-23 entry
  below quoted.

**Changed** both nodes 0.0506 → 0.0560, `last_verified` 2026-10-17, history regenerated (the
0.0506 rows close at 2026-01-01; nothing else moved). The other six BC rates and all seven
thresholds already matched gov.bc.ca.

**Impact — the live site under-stated BC tax from 2026-07-23 to 2026-10-17.** Real engine, BC
provincial tax, employee: $40,000 +$129.39 · $60,000 +$180.21 · $100,000 and $150,000 +$175.52 per
year (bracket at the wrong rate +$214–$272, credits at the wrong rate −$85–$96; net as shown).
Self-employed: +$121.18 / +$185.49 / +$181.59 / +$181.59.

**Lesson** (now Rule 1 step 4): a correct value that looks like a typo must be checked against
the current year's row in the current edition before it is touched.

## 2026-07-15 — Inaugural full audit (all live jurisdictions + benefits)

First complete pass of the maintenance system: every constant re-checked against primary
sources **from scratch**, ignoring existing code comments and prior verification stamps.
Method — federal/CPP/EI, western (BC/SK/MB), Atlantic+territories, and benefits (CCB/ESA/LTT)
verified in parallel against CRA / provincial-finance / municipal sources; the two known-open
items (ON surtax tier-2, Alberta) and Ontario + Quebec verified directly against the CRA
T4032 and Revenu Québec tables.

**Result: 1 correction, 0 unverified, everything else confirmed.**

### The one correction
- **Newfoundland & Labrador BPA — CORRECTED $11,188 → $13,094.** The code held the
  pre-budget 2026 value: $11,188 is 2025's $11,067 indexed by NL's 1.1%, as CRA's January
  T4032NL printed it. NL Budget 2026 (Apr 29, 2026) raised the BPA to **$13,094** effective
  Jan 1, 2026 (gov.nl.ca Finance "provincial non-refundable credits table"), and that is the
  amount claimed on the **2026 return** (what an annual calculator uses). *(Corrected
  2026-10-20: this entry first said $11,188 was the 2025 value and that NL was phasing toward
  a $15,000 exemption. CRA's July T4032NL shows $15,000 is only a prorated payroll BPA for
  July–December, so the year averages ($11,188 + $15,000) / 2 = $13,094. It is a half-year
  catch-up, not a phase-in target.)* Regression: only NL take-home moved (+~$166 at $65k); all other
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
- **NL** — re-read the 2027 BPA from gov.nl.ca and the January T4032NL as for any other year. There
  is no $15,000 phase-in to expect: that figure was only CRA's prorated July–December 2026 payroll
  amount (corrected 2026-10-20).
- **CCB** — 2026–27 amounts now official; next re-index is **July 2027**.

## 2026-07-24 — The Alberta near-miss: current-year rates applied to historical years

Caught during the DTC build, before it shipped. Worth recording because it is a **different**
failure from the BC one and would have been **larger**.

**What almost happened.** The DTC values a disability amount at each jurisdiction's LOWEST rate
*for that tax year*. The generator that emits the retroactive (2016–2025) constants was about to
use the **2026** rate table — the one verified against CRA T4032 — for every historical year.
That table has **Alberta at 8%**, because AB cut its lowest bracket from 10% to 8% **from the 2025
tax year**. Applying 8% to 2016–2024 would have understated every Alberta retroactive DTC claim by
**2 percentage points on ~$136,000 of cumulative disability amounts — roughly $2,700 per
claimant**, far larger than the NB/PEI rate drift (~$170) that prompted the check.

> **Correction, 2026-10-03.** This note originally dated the cut to 2026 and the DTC row for 2025
> was stamped at 10%. Both were wrong: alberta.ca puts the 8% bracket "Effective January 1, 2025",
> CRA's 2026 T4032-AB says "For 2025 and subsequent tax years, the lowest tax bracket will be 8%"
> (payroll used a prorated 6% from July 2025 to catch up), and the 2025 AB428 values the
> disability amount at 8% (line 53). CRA's 2025 rates-page footnote "added on July 1, 2025"
> describes the payroll start, not a split tax year. `dtc.provincial.AB.y2025.rate` is now 0.08;
> 2016–2024 stay at 10%, confirmed against the 2019 and 2024 AB428. The irony is the lesson
> restated: the guard against pairing a rate with the wrong year paired this one with the wrong
> year, and the invariant that should have caught it skipped Alberta because it only compares
> when the DTC year and the bracket-table year coincide.

**Why no gate would have caught it.** Every value would have been individually correct-looking and
correctly stamped: 8% *is* Alberta's real lowest rate, sourced from the CRA T4032, freshly
verified. `check-constants` validates provenance hygiene, not the *pairing* of a rate with a tax
year. `check-history` compares stored values to live stamps — both would agree. Only the domain
fact "a closed tax year uses that year's rate" catches it, and nothing in the repo encodes that.

**The general rule this establishes.** *A verified value is only correct in the context it was
verified for.* A rate confirmed for 2026 is evidence about 2026 and nothing else. When a constant
is indexed by year, jurisdiction, or period, the **index is part of the value** — re-verify the
pairing, not just the number. The same trap produced the stale-page bug found the same day (see
below): canada.ca's own archived guides for 2024/2025 served **2022** content, and the values were
internally consistent and plausible there too.

**A third variant, caught at commit time — the mid-year snapshot.** Saskatchewan's DTC row for
2017 was stamped at **11%**, taken from the CRA "Tax rates and income brackets" page captured
**2017-07-17** and correctly labelled tax year 2017. It was still wrong. SK cut its rate a half
point **effective July 1, 2017**, and Saskatchewan's own backgrounder states *"the 2017 rates
reflect the impact of the half point reduction midway through the 2017 taxation year"* — so the
settled **annual** rate for the 2017 return is a blend, while the capture showed the **pre-cut**
rate from 16 days earlier. Note what passed here: a real government page, right jurisdiction,
right tax year label, plausible value. **For a jurisdiction that changes a rate mid-year, a
snapshot is only valid if taken after the year closed.** The blended figure would have been our
own arithmetic, not a published number, so 2017 was recorded as a gap alongside SK 2016 and 2018
rather than computed — the same reason a per-year-derivation approach was rejected earlier.

**Two detections that worked, keep them:**
- **Year-label check** — read the tax year the source page *declares* ("New for Ontario for 2022")
  and assert it matches the year being requested. This caught both the 2024/2025 stale guides and
  a mislabeled NT 2022 page that serves 2023 content.
- **Monotonicity check** — indexed amounts never decrease year-over-year. This caught the stale
  2024/2025 values, which appeared to "drop" back to 2022 levels. Note it only catches
  *decreases*: Saskatchewan's genuine +28% jump in 2025 passed silently and had to be corroborated
  separately (its whole credit table moved in lockstep — confirmed real).

## 2026-07-23 — BC lowest-rate correction (out-of-cycle, data-entry error)

> **SUPERSEDED — this entry is wrong.** 0.0560 was correct for 2026; this change introduced the
> error it describes. See 2026-10-17 above. Kept as written so the reasoning that failed stays
> visible.

**Found.** British Columbia's lowest bracket rate was stored as `0.0560` in **both**
`provinces.BC.brackets[0].rate` and `provinces.BC.bpaCreditRate` — a dropped-zero transcription
of the true **5.06% (`0.0506`)**. The other six BC bracket rates were already correct. This had
shipped in the live payroll calculators, so every BC take-home result was computing the first
bracket at 5.6% instead of 5.06%.

**Verified** against two primary sources: `gov.bc.ca` personal income tax rates ("$0 to $49,279 —
**5.06%**") and CRA **T4032BC** ("Multiply the total on line 17 by **5.06% × 0.0506**"). Corrected
both nodes to `0.0506`, bumped `last_verified` to 2026-07-23, and regenerated
`constant-history.json` (the file is a regenerator, not an accumulator — the git diff is the audit
trail). **check-constants and check-history both PASS**; the `bpaCreditRate === brackets[0].rate`
invariant still holds because both fields were corrected together.

**Regression (BC only, all other jurisdictions byte-identical).** Provincial tax falls / net rises:
about **+$79/yr at $30k**, peaking **~+$182/yr around $51k**, then decaying to a **+$175.52/yr floor
above ~$75k**. The delta is `0.0054 × (min(taxable, $50,363) − creditBase)` where
`creditBase = BPA + base-CPP + EI` — it climbs as the first bracket fills, then shrinks as the
payroll-contribution credits (also valued at the lowest rate) cap out.

**Why the gate missed it — this is the important part.** `check-constants` verifies **provenance
hygiene** (stamped / sourced / dated / within-cadence) plus one cross-field invariant
(`bpaCreditRate === brackets[0].rate`). The value was fully stamped and fresh, and the invariant
was **satisfied** because both fields held the *same* wrong number. **A wrong-but-plausible,
internally-consistent, freshly-stamped rate passes every offline check.** The gate cannot catch a
value that is wrong against its external source — only re-verification against the primary document
does. A full sweep of all 13 jurisdictions' lowest rates against CRA T4032 confirmed **BC was the
only error**. Lesson for the January (Rule 1) pass: re-open the source for the rate, don't trust a
green checker — the checker only proves the *stamp* is well-formed, never that the *number* is right.
