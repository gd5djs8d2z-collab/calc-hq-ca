/**
 * sync-tax-brackets.mjs — writes the generated parts of the /tax-brackets/ pages from the
 * constants and the tax engine, so no bracket, rate or threshold is ever typed into the HTML.
 *
 * WHY STATIC, AND WHY GENERATED
 *   The tables have to be in the served HTML (crawlers read them; there is no runtime fill on
 *   this site), and they have to come from data/tax-constants-2026.js, never re-keyed. So this
 *   script owns every region between `<!-- tb:NAME:start -->` and `<!-- tb:NAME:end -->` and
 *   rewrites it. Prose outside those regions is hand-written and its $/% figures are registered
 *   in data/prose-figures.json like any other page (check-prose-figures skips tb: regions,
 *   because this script's --check is what guards them).
 *
 * REGIONS (each page declares the ones it uses)
 *   head        <title>, meta description, og:title, og:description — the year comes from TAX_YEAR
 *   h1          the page heading, same
 *   federal     federal bracket table (TC.federal.brackets)
 *   provincial  the jurisdiction's bracket table (TC.provinces.XX.brackets)
 *   bpa         basic personal amounts, federal and the jurisdiction's
 *   marginal    combined marginal rates, found by RUNNING THE ENGINE across the income range:
 *               calcIncomeTax (no CPP/EI — interest, pension, rental) and calcTakeHome (salary).
 *               Nothing is added by hand; a surtax, a premium ramp or a phase-out shows up
 *               because the engine charges it.
 *
 * HOW THE MARGINAL TABLE IS FOUND
 *   Scan $0 to past the top threshold in $25 steps, reading the tax on the next dollar for both profiles.
 *   Wherever either rate moves, bisect to the exact dollar. Then merge neighbouring bands whose
 *   two rates agree to the displayed precision, and label each boundary by matching it against
 *   the stamped thresholds (or, where none matches, by which part of the engine changed).
 *
 * USAGE
 *   node scripts/sync-tax-brackets.mjs           # rewrite every listed page
 *   node scripts/sync-tax-brackets.mjs --check   # exit 1 if any page differs from what it would write
 *   node scripts/sync-tax-brackets.mjs --print ON  # print the marginal bands for a jurisdiction
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const ratesUrl = new URL('data/rates-2026.js', ROOT).href;
const { TAX_CONSTANTS_2026: TC, TAX_YEAR } = await import(new URL('data/tax-constants-2026.js', ROOT).href);
const engineSrc = readFileSync(new URL('assets/js/tax-engine.js', ROOT), 'utf8');
const SPEC = "'/data/rates-2026.js'";
if (engineSrc.split(SPEC).length !== 2) throw new Error(`tax-engine.js should import ${SPEC} exactly once`);
const E = await import('data:text/javascript,' + encodeURIComponent(engineSrc.replace(SPEC, JSON.stringify(ratesUrl))));
const R = await import(ratesUrl);

const v = (node) => node.value;
const money = (n) => '$' + Math.round(n).toLocaleString('en-CA');
// Half up, past float noise: Quebec's top rate is exactly 53.305%, and a next-dollar difference
// lands either side of the half by a few ulps, which would read as a rate change that isn't there.
const pct = (r, d = 2) => `${(Math.round(r * 10 ** (d + 2) + 1e-6) / 10 ** d).toFixed(d)}%`;
const rate = (r) => `${+(r * 100).toFixed(3)}%`;        // bracket rates as published: 5.05%, 20.5%, 14%

/** The posted top provincial rate, and what the engine actually charges on a top-bracket dollar. */
const topRate = (code) => v(TC.provinces[code].brackets).at(-1).rate;
const topRealRate = (code) => {
  const f = (x) => E.calcIncomeTax(x, code).provincialTax, x = v(TC.provinces[code].brackets).at(-1).min + 100000;
  return f(x + 1) - f(x);
};

/* ── Pages ─────────────────────────────────────────────────────────────────── */
const PAGES = [
  {
    file: 'tax-brackets/ontario/index.html',
    code: 'ON',
    title: (y) => `Ontario Tax Brackets ${y}: Rates, Surtax and Real Marginal Rates | calc-hq.ca`,
    description: (y) => `Ontario's ${y} tax brackets with the federal rates, and the combined marginal rate on every band — including the surtax and Health Premium that push real rates past the posted ones.`,
    ogTitle: (y) => `Ontario Tax Brackets ${y} — and What You Really Pay on the Next Dollar`,
    ogDescription: (y) => `Ontario's ${y} brackets, the surtax that raises its top rate from ${rate(topRate('ON'))} to ${pct(topRealRate('ON'))}, and a marginal-rate table computed by running the tax engine.`,
    h1: (y) => `Ontario Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/british-columbia/index.html',
    code: 'BC',
    title: (y) => `British Columbia Tax Brackets ${y}: Rates, the ${pct(lowRate('BC'))} Change and Marginal Rates | calc-hq.ca`,
    description: (y) => `BC's ${y} tax brackets beside the federal ones: the lowest rate at ${pct(lowRate('BC'))}, the BC tax reduction that lifts the rate on lower incomes, and the combined rate on every band.`,
    ogTitle: (y) => `British Columbia Tax Brackets ${y} — Seven Rates and What They Add Up To`,
    ogDescription: (y) => `BC's ${y} brackets from ${pct(lowRate('BC'))} to ${rate(topRate('BC'))}, and a marginal-rate table computed by running the tax engine, reduction and all.`,
    h1: (y) => `British Columbia Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/alberta/index.html',
    code: 'AB',
    title: (y) => `Alberta Tax Brackets ${y}: The ${rate(lowRate('AB'))} Bracket and Marginal Rates | calc-hq.ca`,
    description: (y) => `Alberta's ${y} tax brackets with the federal rates: ${rate(lowRate('AB'))} on the first ${money(v(TC.provinces.AB.brackets)[0].max)}, a ${money(v(TC.provinces.AB.bpa))} basic personal amount, and the combined rate on every band.`,
    ogTitle: (y) => `Alberta Tax Brackets ${y} — From ${rate(lowRate('AB'))} to ${rate(topRate('AB'))}`,
    ogDescription: (y) => `Alberta's six ${y} brackets and a combined marginal-rate table computed by running the tax engine across the income range.`,
    h1: (y) => `Alberta Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/saskatchewan/index.html',
    code: 'SK',
    title: (y) => `Saskatchewan Tax Brackets ${y}: Three Rates and Real Marginal Rates | calc-hq.ca`,
    description: (y) => `Saskatchewan's ${y} tax brackets with the federal rates, its ${money(v(TC.provinces.SK.bpa))} basic personal amount, and the combined federal and Saskatchewan rate on every band.`,
    ogTitle: (y) => `Saskatchewan Tax Brackets ${y} — Three Rates, Eight Bands`,
    ogDescription: (y) => `Saskatchewan's ${y} brackets at ${rate(lowRate('SK'))}, ${rate(v(TC.provinces.SK.brackets)[1].rate)} and ${rate(topRate('SK'))}, and a marginal-rate table computed by running the tax engine.`,
    h1: (y) => `Saskatchewan Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/quebec/index.html',
    code: 'QC',
    title: (y) => `Quebec Tax Brackets ${y}: Provincial Rates, the Federal Abatement and Marginal Rates | calc-hq.ca`,
    description: (y) => `Quebec's ${y} tax brackets, the federal brackets after the ${rate(v(TC.quebec.federalAbatementRate))} Quebec abatement, and the combined marginal rate on every band.`,
    ogTitle: (y) => `Quebec Tax Brackets ${y} — Two Returns, One Marginal Rate`,
    ogDescription: (y) => `Quebec's ${y} brackets from ${rate(lowRate('QC'))} to ${rate(topRate('QC'))}, the abatement that trims every federal rate, and a marginal-rate table computed by running the tax engine.`,
    h1: (y) => `Quebec Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/yukon/index.html',
    code: 'YT',
    title: (y) => `Yukon Tax Brackets ${y}: Territorial Rates and Real Marginal Rates | calc-hq.ca`,
    description: (y) => `Yukon's ${y} tax brackets, which share the federal thresholds, the basic personal amount that shrinks with the federal one, and the combined rate on every band.`,
    ogTitle: (y) => `Yukon Tax Brackets ${y} — Built on the Federal Thresholds`,
    ogDescription: (y) => `Yukon's ${y} brackets from ${rate(lowRate('YT'))} to ${rate(topRate('YT'))}, and a marginal-rate table computed by running the tax engine.`,
    h1: (y) => `Yukon Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/northwest-territories/index.html',
    code: 'NT',
    title: (y) => `Northwest Territories Tax Brackets ${y}: Rates and Marginal Rates | calc-hq.ca`,
    description: (y) => `The Northwest Territories' ${y} tax brackets with the federal rates, its ${money(v(TC.provinces.NT.bpa))} basic personal amount, and the combined rate on every band.`,
    ogTitle: (y) => `Northwest Territories Tax Brackets ${y} — Four Rates, Federal Included`,
    ogDescription: (y) => `NWT's ${y} brackets from ${rate(lowRate('NT'))} to ${rate(topRate('NT'))}, and a marginal-rate table computed by running the tax engine.`,
    h1: (y) => `Northwest Territories Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/nunavut/index.html',
    code: 'NU',
    title: (y) => `Nunavut Tax Brackets ${y}: Canada's Lowest Rates and Marginal Rates | calc-hq.ca`,
    description: (y) => `Nunavut's ${y} tax brackets, from ${rate(lowRate('NU'))} to ${rate(topRate('NU'))}, beside the federal ones, and the combined federal and territorial rate on every band.`,
    ogTitle: (y) => `Nunavut Tax Brackets ${y} — the Lowest Rates in Canada`,
    ogDescription: (y) => `Nunavut's ${y} brackets and a marginal-rate table computed by running the tax engine across the income range.`,
    h1: (y) => `Nunavut Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/manitoba/index.html',
    code: 'MB',
    title: (y) => `Manitoba Tax Brackets ${y}: Frozen Thresholds, the BPA Phase-Out and Marginal Rates | calc-hq.ca`,
    description: (y) => `Manitoba's ${y} tax brackets, still at their 2024 levels, the basic personal amount that phases out between ${money(v(TC.provinces.MB.bpaPhaseOut).phaseOutStart)} and ${money(v(TC.provinces.MB.bpaPhaseOut).phaseOutEnd)}, and the combined rate on every band.`,
    ogTitle: (y) => `Manitoba Tax Brackets ${y} — Where the Top Rate Isn't at the Top`,
    ogDescription: (y) => `Manitoba's three ${y} brackets, the BPA phase-out that lifts the rate below ${money(v(TC.provinces.MB.bpaPhaseOut).phaseOutEnd)}, and a marginal-rate table computed by running the tax engine.`,
    h1: (y) => `Manitoba Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/newfoundland-and-labrador/index.html',
    code: 'NL',
    title: (y) => `Newfoundland and Labrador Tax Brackets ${y}: Eight Rates and Marginal Rates | calc-hq.ca`,
    description: (y) => `Newfoundland and Labrador's ${y} brackets, the ${money(v(TC.provinces.NL.bpa))} basic personal amount from the April budget, the low income tax reduction, and the combined rate on every band.`,
    ogTitle: (y) => `Newfoundland and Labrador Tax Brackets ${y} — Up to ${pct(combinedTop('NL'))}`,
    ogDescription: (y) => `NL's eight ${y} brackets from ${rate(lowRate('NL'))} to ${rate(topRate('NL'))}, and a marginal-rate table computed by running the tax engine.`,
    h1: (y) => `Newfoundland and Labrador Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/new-brunswick/index.html',
    code: 'NB',
    title: (y) => `New Brunswick Tax Brackets ${y}: Rates, the Low-Income Reduction and Marginal Rates | calc-hq.ca`,
    description: (y) => `New Brunswick's ${y} tax brackets with the federal rates, the low-income tax reduction that runs to ${money(v(TC.provinces.NB.taxReduction).threshold + v(TC.provinces.NB.taxReduction).base / v(TC.provinces.NB.taxReduction).rate)}, and the combined rate on every band.`,
    ogTitle: (y) => `New Brunswick Tax Brackets ${y} — Four Rates and a Long Taper`,
    ogDescription: (y) => `NB's ${y} brackets from ${rate(lowRate('NB'))} to ${rate(topRate('NB'))}, and a marginal-rate table computed by running the tax engine.`,
    h1: (y) => `New Brunswick Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/nova-scotia/index.html',
    code: 'NS',
    title: (y) => `Nova Scotia Tax Brackets ${y}: Rates, Indexation and Marginal Rates | calc-hq.ca`,
    description: (y) => `Nova Scotia's ${y} tax brackets beside the federal ones, its ${money(v(TC.provinces.NS.bpa))} basic personal amount, the low-income tax reduction, and the combined rate on every band.`,
    ogTitle: (y) => `Nova Scotia Tax Brackets ${y} — Five Rates up to ${rate(topRate('NS'))}`,
    ogDescription: (y) => `Nova Scotia's ${y} brackets and a marginal-rate table computed by running the tax engine across the income range.`,
    h1: (y) => `Nova Scotia Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/prince-edward-island/index.html',
    code: 'PE',
    title: (y) => `Prince Edward Island Tax Brackets ${y}: The New ${rate(topRate('PE'))} Bracket and Marginal Rates | calc-hq.ca`,
    description: (y) => `PEI's ${y} tax brackets, including the sixth bracket at ${rate(topRate('PE'))} over ${money(v(TC.provinces.PE.brackets).at(-1).min)}, the low-income tax reduction, and the combined rate on every band.`,
    ogTitle: (y) => `Prince Edward Island Tax Brackets ${y} — Six Rates from ${rate(lowRate('PE'))}`,
    ogDescription: (y) => `PEI's ${y} brackets and a marginal-rate table computed by running the tax engine, low-income reduction included.`,
    h1: (y) => `Prince Edward Island Tax Brackets ${y}`,
  },
  {
    file: 'tax-brackets/index.html',
    code: null,                                    // the hub: federal table + every jurisdiction side by side
    title: (y) => `Canadian Tax Brackets ${y}: Federal, Provincial and Territorial Rates | calc-hq.ca`,
    description: (y) => `The ${y} federal tax brackets once, then every province and territory: its rates, basic personal amount and the combined rate on a top-bracket dollar.`,
    ogTitle: (y) => `Canadian Tax Brackets ${y} — Federal and All 13 Provinces and Territories`,
    ogDescription: (y) => `Federal brackets from ${rate(v(TC.federal.brackets)[0].rate)} to ${rate(v(TC.federal.brackets).at(-1).rate)}, and every province's and territory's ${y} rates side by side.`,
    h1: (y) => `Canadian Tax Brackets ${y}`,
  },
];

/* ── The hub's side-by-side table ──────────────────────────────────────────── */
// West to east, then the territories. A jurisdiction links to its page only once it has one.
const ORDER = ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'];
const lowRate = (code) => v(TC.provinces[code].brackets)[0].rate;
// The combined rate on a dollar far above every threshold and phase-out in the engine.
const combinedTop = (code) => E.calcIncomeTax(2000001, code).totalTax - E.calcIncomeTax(2000000, code).totalTax;

function summaryTable() {
  const href = Object.fromEntries(PAGES.filter((p) => p.code).map((p) => [p.code, '/' + p.file.replace(/index\.html$/, '')]));
  const rows = ORDER.map((code) => {
    const P = TC.provinces[code], b = v(P.brackets);
    const name = href[code] ? `<a href="${href[code]}">${P.name}</a>` : P.name;
    return `<tr><td>${name}</td><td>${b.length}</td><td>${rate(b[0].rate)}</td><td>${rate(b.at(-1).rate)} over ${money(b.at(-1).min)}</td><td>${money(v(P.bpa))}</td><td>${pct(combinedTop(code))}</td></tr>`;
  }).join('\n          ');
  return `
    <div class="compare-table-wrap">
      <table class="compare-table summary-table">
        <caption>Provincial and territorial income tax, ${TAX_YEAR}</caption>
        <thead><tr><th>Jurisdiction</th><th>Brackets</th><th>Lowest rate</th><th>Top rate</th><th>Basic personal amount</th><th>Combined top rate</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    `;
}

/* ── Engine probes ─────────────────────────────────────────────────────────── */
// The table is income tax on TAXABLE income with no CPP/EI (calcIncomeTax): one rate per band,
// the figure every bracket table means. A salary's rate differs below the CPP/EI ceilings, and
// its thresholds sit higher by the enhanced-CPP deduction; the pages say so in registered prose
// rather than doubling every row.
// Scan past the jurisdiction's top threshold (Yukon's is $500,000) and the federal BPA floor.
const STEP = 25;
const scanTop = (code) => Math.max(400000, v(TC.provinces[code].brackets).at(-1).min + 100000);
const taxOf = (code) => (x) => E.calcIncomeTax(x, code);
const marg = (f, x) => f(x + 1).totalTax - f(x).totalTax;

function bands(code, from) {
  const f = taxOf(code), k = (x) => pct(marg(f, x));
  const pts = [];
  let prev = k(from);
  for (let x = from + STEP, top = scanTop(code); x <= top; x += STEP) {
    const cur = k(x);
    // Two changes can share one step (Nunavut's 11.5% bracket starts at $181,439, a dollar
    // under the federal $181,440), so keep bisecting from each boundary until the step's end agrees.
    let lo = x - STEP;
    while (cur !== prev) {
      let hi = x;                                // k(lo) === prev, k(hi) !== prev
      while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); k(mid) === prev ? (lo = mid) : (hi = mid); }
      pts.push(hi);
      prev = k(hi);
      lo = hi;
    }
  }
  // A threshold that falls inside a dollar (the surtax and tax-reduction points do) leaves that one
  // dollar at an in-between rate. Fold it into the band it opens, unless the dollar's far edge is
  // itself a stamped point — Nunavut's $181,439 to the federal $181,440 is a real one-dollar band.
  const known = knownPoints(code);
  const edges = [from, ...pts.filter((p, i) => !((i ? pts[i - 1] : from) === p - 1 && !known.some(([x]) => x === p)))];
  return edges.map((a, i) => {
    const b = edges[i + 1] ?? Infinity;
    const x = b === Infinity ? a + 1000 : Math.floor((a + b) / 2);
    return { from: a, to: b, rate: marg(f, x) };
  });
}

/* ── Boundary labels ───────────────────────────────────────────────────────── */
function knownPoints(code) {
  const P = TC.provinces[code], out = [];
  v(TC.federal.brackets).slice(1).forEach((b) => out.push([b.min, `federal ${rate(b.rate)} bracket`]));
  v(P.brackets).slice(1).forEach((b) => out.push([b.min, `${P.name} ${rate(b.rate)} bracket`]));
  const bpa = v(TC.federal.bpa);
  out.push([bpa.phaseOutStart, 'federal basic personal amount starts shrinking']);
  out.push([bpa.phaseOutEnd, 'federal basic personal amount at its floor']);
  if (P.bpaPhaseOut) {                             // Yukon tracks the federal BPA; Manitoba's runs out to $0
    const p = v(P.bpaPhaseOut);
    out.push([p.phaseOutStart, `${P.name} basic personal amount starts shrinking`]);
    out.push([p.phaseOutEnd, p.min === 0 ? `${P.name} basic personal amount fully phased out` : `${P.name} basic personal amount at its floor`]);
  }
  if (P.familyTaxBenefit) {                        // Manitoba: a credit amount of base − 9% of income
    const f = v(P.familyTaxBenefit);
    out.push([f.amount / f.rate, `${P.name} family tax benefit runs out`, 1]);
  }
  if (P.taxReduction) {                            // BC, NL, NB, NS, PE: base − rate × (income − threshold)
    const t = v(P.taxReduction);
    out.push([t.threshold, `${P.name} tax reduction starts shrinking`]);
    // Not a whole dollar ($44,952.25 in 2026), so the scan's boundary lands within a dollar of it.
    out.push([t.threshold + t.base / t.rate, `${P.name} tax reduction runs out`, 1]);
  }
  return out;
}

function label(code, band) {
  const near = knownPoints(code).filter(([x, , tol = 0]) => Math.abs(x - band.from) <= tol).map(([, l]) => l);
  if (near.length) return near.join(' + ');
  // No stamped threshold here — say which part of the engine moved, in its own numbers.
  const f = taxOf(code), x = band.from, a = f(x - 1), b = f(x), c = f(x + 1);
  const d = (k) => (c[k] - b[k]) - (b[k] - a[k]);
  if (Math.abs(d('surtax')) > 1e-6) {
    const t = v(TC.provinces[code].surtax).find((t) => Math.abs(b.provincialBasic - t.over) < 1);
    return `surtax: ${pct(t.rate, 0)} of ${TC.provinces[code].name} tax over ${money(t.over)}`;
  }
  if (Math.abs(d('healthPremium')) > 1e-6) {
    const slope = c.healthPremium - b.healthPremium;
    if (slope > 1e-6) {
      let top = x;                                 // follow the ramp to its top, not the row's end:
      while (f(top + 1).healthPremium - f(top).healthPremium > 1e-9) top++;   // a row can stop mid-ramp
      const cap = f(top).healthPremium;
      return `Health Premium climbs ${pct(slope, 0)} of income, ${money(b.healthPremium)} → ${money(cap)}`;
    }
    return `Health Premium holds at ${money(b.healthPremium)}`;
  }
  const P = TC.provinces[code];
  const provStarts = Math.abs(d('provincialTax')) > 1e-6 && a.provincialTax < 1e-9;
  if (Math.abs(d('federalTax')) > 1e-6 && a.federalTax < 1e-9)
    return 'federal basic personal amount used up' + (provStarts ? ` + ${P.name}'s` : '');
  // What the province gives back after the surtax (Ontario: the s. 20 tax reduction; LIFT needs
  // employment income, which calcIncomeTax never has): basic + surtax + premium − the total.
  const back = (t) => t.provincialBasic + t.surtax + t.healthPremium - t.provincialTax;
  if (Math.abs((back(c) - back(b)) - (back(b) - back(a))) > 1e-6) {
    return back(c) > 1e-9 ? `${P.name} tax reduction starts shrinking` : `${P.name} tax reduction runs out`;
  }
  // The first dollar of provincial tax: past the basic personal amount, or (BC) past the point
  // where the income-tested reduction no longer covers all of it.
  // Below the reduction's threshold the full reduction is used up; above it (NB, NS), tax starts
  // because the reduction is shrinking faster than it can keep covering the tax.
  if (provStarts) {
    if (P.familyTaxBenefit) return `${P.name} basic personal amount and family tax benefit used up`;
    if (!P.taxReduction) return `${P.name} basic personal amount used up`;
    return x <= v(P.taxReduction).threshold ? `${P.name} tax starts: the reduction is used up`
      : `${P.name} tax starts: the shrinking reduction no longer covers it`;
  }
  throw new Error(`${code}: no label for the rate change at ${money(x)}`);
}

/* ── Region renderers ──────────────────────────────────────────────────────── */
function bracketTable(brackets, caption) {
  const rows = brackets.map((b) =>
    `<tr><td>${b.min === 0 ? '$0' : money(b.min)}</td><td>${b.max === Infinity ? 'and up' : money(b.max)}</td><td>${rate(b.rate)}</td></tr>`).join('\n          ');
  return `
    <div class="compare-table-wrap">
      <table class="compare-table bracket-table">
        <caption>${caption}</caption>
        <thead><tr><th>Taxable income over</th><th>Up to</th><th>Rate on that slice</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    `;
}

function bpaTable(code) {
  const P = TC.provinces[code], fb = v(TC.federal.bpa);
  const fRate = v(TC.federal.brackets)[0].rate, pRate = v(P.bpaCreditRate);
  return `
    <div class="compare-table-wrap">
      <table class="compare-table bracket-table">
        <caption>Basic personal amounts, ${TAX_YEAR}</caption>
        <thead><tr><th>Credit</th><th>Amount</th><th>Valued at</th><th>Tax it removes</th></tr></thead>
        <tbody>
          <tr><td>Federal, net income up to ${money(fb.phaseOutStart)}</td><td>${money(fb.max)}</td><td>${rate(fRate)}</td><td>${money(fb.max * fRate)}</td></tr>
          <tr><td>Federal, net income ${money(fb.phaseOutEnd)} and up</td><td>${money(fb.min)}</td><td>${rate(fRate)}</td><td>${money(fb.min * fRate)}</td></tr>
          ${P.bpaPhaseOut ? ((p) => `<tr><td>${P.name}, net income up to ${money(p.phaseOutStart)}</td><td>${money(p.max)}</td><td>${rate(pRate)}</td><td>${money(p.max * pRate)}</td></tr>
          <tr><td>${P.name}, net income ${money(p.phaseOutEnd)} and up</td><td>${money(p.min)}</td><td>${rate(pRate)}</td><td>${money(p.min * pRate)}</td></tr>`)(v(P.bpaPhaseOut))
            : `<tr><td>${P.name}</td><td>${money(v(P.bpa))}</td><td>${rate(pRate)}</td><td>${money(v(P.bpa) * pRate)}</td></tr>`}
        </tbody>
      </table>
    </div>
    `;
}

function marginalTable(page) {
  const code = page.code, P = TC.provinces[code];
  const rows = bands(code, 0).map((b, i) => {
    const range = b.to === Infinity ? `${money(b.from)} and up` : `${money(b.from)} – ${money(b.to)}`;
    return `<tr><td>${range}</td><td>${pct(b.rate)}</td><td>${i === 0 ? '' : label(code, b)}</td></tr>`;
  }).join('\n          ');
  return `
    <div class="compare-table-wrap">
      <table class="compare-table marginal-table">
        <caption>Combined federal + ${P.name} marginal rate, ${TAX_YEAR}</caption>
        <thead><tr><th>Taxable income</th><th>Tax on the next dollar</th><th>What starts here</th></tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    `;
}

function render(page, name) {
  const y = TAX_YEAR, P = page.code && TC.provinces[page.code];
  switch (name) {
    case 'head': return `
<title>${page.title(y)}</title>
<meta name="description" content="${page.description(y)}">
<meta property="og:title" content="${page.ogTitle(y)}">
<meta property="og:description" content="${page.ogDescription(y)}">
`;
    case 'h1': return `<h1>${page.h1(y)}</h1>`;
    case 'federal': return bracketTable(v(TC.federal.brackets), `Federal tax brackets, ${y}`);
    case 'provincial': return bracketTable(v(P.brackets), `${P.name} tax brackets, ${y}`);
    case 'bpa': return bpaTable(page.code);
    case 'marginal': return marginalTable(page);
    case 'summary': return summaryTable();
    default: throw new Error(`${page.file}: unknown region tb:${name}`);
  }
}

/* ── Rewrite / check ───────────────────────────────────────────────────────── */
const REGION = /(<!-- tb:([a-z0-9]+):start -->)[\s\S]*?(<!-- tb:\2:end -->)/g;

function sync(page) {
  const url = new URL(page.file, ROOT), html = readFileSync(url, 'utf8');
  const seen = [];
  const out = html.replace(REGION, (m, open, name, close) => { seen.push(name); return open + render(page, name) + close; });
  for (const need of ['head', 'h1']) if (!seen.includes(need)) throw new Error(`${page.file}: missing tb:${need} region`);
  return { url, html, out, seen };
}

const args = process.argv.slice(2);
if (args[0] === '--print') {
  const code = args[1] || 'ON';
  bands(code, 0).forEach((b, i) => console.log(`${String(b.from).padStart(7)} ${String(b.to).padStart(8)}  ${pct(b.rate).padStart(7)}  ${i ? label(code, b) : ''}`));
} else {
  const check = args.includes('--check');
  let drift = 0;
  for (const page of PAGES) {
    const { url, html, out, seen } = sync(page);
    if (out === html) { console.log(`  ok      ${page.file} (${seen.join(', ')})`); continue; }
    if (check) { drift++; console.log(`  DRIFT   ${page.file} — run node scripts/sync-tax-brackets.mjs`); }
    else { writeFileSync(url, out); console.log(`  wrote   ${page.file} (${seen.join(', ')})`); }
  }
  if (check) {
    console.log(drift ? `\nFAIL — ${drift} page(s) differ from the constants.` : `\nPASS — ${PAGES.length} page(s) match the constants and the engine.`);
    process.exit(drift ? 1 : 0);
  }
}
