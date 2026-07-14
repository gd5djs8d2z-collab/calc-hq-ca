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

### Quebec — the inaugural run

Quebec is deliberately **not** in the constants file yet. It is added **tomorrow** as the
first real exercise of this system: QPP (not CPP), QPIP (not federal EI parental), and the
16.5% federal abatement, each verified against Revenu Québec + CRA and stamped with a
`source_url` and `last_verified` the same way. If the framework holds up for Quebec, it
holds up.

### Not yet migrated

Benefit-program constants (CCB, EI maternity/parental, CPP-timing, Land Transfer Tax, ESA)
still live inline in `rates-2026.js` with their own source/verified comments. They are out
of scope for the January income-tax audit (different cadences — e.g. CCB re-indexes in
**July**, LTT/ESA change only by legislation). Migrating them into the same provenance
structure is a sensible follow-up.
