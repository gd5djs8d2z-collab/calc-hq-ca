# Tax-constant maintenance

Every income-tax / payroll constant on calc-hq.ca lives once, with provenance, in
[`data/tax-constants-2026.js`](data/tax-constants-2026.js). Each value carries
`{ value, source_url, last_verified }`. `data/rates-2026.js` derives the runtime objects
(`FEDERAL`, `CPP`, `EI`, `PROVINCES`) from it — so you change a number in **one** place.

Two standing rules keep it honest.

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

## Rule 2 — Budget-watch (ongoing, not scheduled)

When a province or territory tables a **mid-year** tax change, verify against the
**enacted statute / the government's own announcement — not the CRA T4032 table.** The
T4032 is published in January and **lags** in-year legislation.

**Worked example — PEI, 2026.** PEI's Bill No. 23 (2026 budget) added a sixth bracket
(over $200,000 @ 20%) and shifted the fifth threshold to $142,520. CRA's T4032-PE still
showed the pre-Bill-23 five-bracket table (top $142,250 @ 19%). We used the **enacted PEI
law** and recorded `source_url` as the PEI finance page, not the CRA table. Do the same
for any future mid-year change: statute first, and note in a comment when the T4032 lags.

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

### Not yet migrated

Benefit-program constants (CCB, EI maternity/parental, CPP-timing, Land Transfer Tax, ESA)
still live inline in `rates-2026.js` with their own source/verified comments. They are out
of scope for the January income-tax audit (different cadences — e.g. CCB re-indexes in
**July**, LTT/ESA change only by legislation). Migrating them into the same provenance
structure is a sensible follow-up.

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
