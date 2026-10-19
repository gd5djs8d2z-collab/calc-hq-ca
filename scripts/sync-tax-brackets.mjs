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
 *   Scan $0 to SCAN_TOP in $25 steps, reading the tax on the next dollar for both profiles.
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
const pct = (r, d = 2) => `${(r * 100).toFixed(d)}%`;
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
];

/* ── Engine probes ─────────────────────────────────────────────────────────── */
// The table is income tax on TAXABLE income with no CPP/EI (calcIncomeTax): one rate per band,
// the figure every bracket table means. A salary's rate differs below the CPP/EI ceilings, and
// its thresholds sit higher by the enhanced-CPP deduction; the pages say so in registered prose
// rather than doubling every row.
const SCAN_TOP = 400000, STEP = 25;
const taxOf = (code) => (x) => E.calcIncomeTax(x, code);
const marg = (f, x) => f(x + 1).totalTax - f(x).totalTax;

function bands(code, from) {
  const f = taxOf(code), k = (x) => pct(marg(f, x));
  const pts = [];
  let prev = k(from);
  for (let x = from + STEP; x <= SCAN_TOP; x += STEP) {
    const cur = k(x);
    if (cur !== prev) {
      let lo = x - STEP, hi = x;                 // k(lo) === prev, k(hi) === cur
      while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); k(mid) === prev ? (lo = mid) : (hi = mid); }
      pts.push(hi);
      prev = cur;
    }
  }
  const edges = [from, ...pts];
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
  return out;
}

function label(code, band) {
  const near = knownPoints(code).filter(([x]) => x === band.from).map(([, l]) => l);
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
  if (Math.abs(d('federalTax')) > 1e-6 && a.federalTax < 1e-9) return 'federal basic personal amount used up';
  // What the province gives back after the surtax (Ontario: the s. 20 tax reduction; LIFT needs
  // employment income, which calcIncomeTax never has): basic + surtax + premium − the total.
  const back = (t) => t.provincialBasic + t.surtax + t.healthPremium - t.provincialTax;
  if (Math.abs((back(c) - back(b)) - (back(b) - back(a))) > 1e-6) {
    const P = TC.provinces[code];
    return back(c) > 1e-9 ? `${P.name} tax reduction starts shrinking` : `${P.name} tax reduction runs out`;
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
          <tr><td>${P.name}</td><td>${money(v(P.bpa))}</td><td>${rate(pRate)}</td><td>${money(v(P.bpa) * pRate)}</td></tr>
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
  const y = TAX_YEAR, P = TC.provinces[page.code];
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
