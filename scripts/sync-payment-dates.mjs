/**
 * sync-payment-dates.mjs — writes the date tables on the per-benefit payment-date pages from the
 * stamped constants, so no payment date is ever typed into the HTML.
 *
 * WHY
 *   The tables must be in the served HTML (crawlers read them; the countdown script only adds a
 *   status column), and they must come from benefitPaymentDates2026 in data/tax-constants-2026.js,
 *   never re-keyed. This script owns every region between `<!-- pd:NAME:start -->` and
 *   `<!-- pd:NAME:end -->` and rewrites it; --check fails CI when a page lags the constants.
 *   (The combined calendar at /key-dates-limits/ccb-payment-dates/ predates this script and keeps
 *   its hand-written tables; its title and URL are deliberately left alone.)
 *
 * REGIONS
 *   ccb        Canada child benefit, monthly — notes where the date moves off the 20th
 *   otb        Ontario Trillium Benefit, monthly — notes where it moves off the 10th, the rule CRA
 *              states for the OTB (weekend or statutory holiday → last working day before)
 *   gst        GST/HST credit + CGEB, quarterly — notes which name each payment was made under
 *   cppOasGis  the shared Service Canada pension schedule
 *   Weekdays and "moves off the Nth" notes are calendar arithmetic on the stamped dates, not
 *   claims about why; the prose says why only where the source does.
 *
 * USAGE
 *   node scripts/sync-payment-dates.mjs           # rewrite every listed page
 *   node scripts/sync-payment-dates.mjs --check   # exit 1 if any page differs from what it would write
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const { TAX_CONSTANTS_2026: TC } = await import(new URL('data/tax-constants-2026.js', ROOT).href);
const D = TC.benefitPaymentDates2026;
const v = (node) => node.value;

const PAGES = [
  'key-dates-limits/canada-child-benefit-payment-dates/index.html',
  'key-dates-limits/gst-hst-credit-payment-dates/index.html',
  'key-dates-limits/cpp-payment-dates/index.html',
  'key-dates-limits/oas-gis-payment-dates/index.html',
  'key-dates-limits/ontario-trillium-benefit-payment-dates/index.html',
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const parts = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
const long = (iso) => { const p = parts(iso); return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`; };
const ordinal = (n) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** Why a date sits off its usual day, from the calendar alone. */
function offDay(iso, usual) {
  const p = parts(iso);
  if (p.d === usual) return '';
  const t = parts(`${p.y}-${String(p.m).padStart(2, '0')}-${String(usual).padStart(2, '0')}`);
  if (t.dow === 0 || t.dow === 6) return `the ${ordinal(usual)} is a ${DAYS[t.dow]}`;
  return `${usual - p.d} days ahead of the ${ordinal(usual)}`;
}

function table(key, rows, { first = 'Month', note = null } = {}) {
  const body = rows.map((r) => {
    const p = parts(r.date);
    const cells = [`<td>${r.label}</td>`, `<td>${long(r.date)}</td>`, `<td>${DAYS[p.dow]}</td>`];
    if (note) cells.push(`<td>${r.note}</td>`);
    cells.push('<td class="st"></td>');
    return `<tr data-date="${r.date}">${cells.join('')}</tr>`;
  }).join('\n          ');
  const head = [first, 'Payment date', 'Day', ...(note ? [note] : []), 'Status'].map((h) => `<th>${h}</th>`).join('');
  return `
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead><tr>${head}</tr></thead>
        <tbody data-benefit="${key}">
          ${body}
        </tbody>
      </table>
    </div>
    `;
}

const monthly = (dates, usual) => dates.map((d) => ({ date: d, label: MONTHS[parts(d).m - 1], note: usual ? offDay(d, usual) : '' }));

function render(name) {
  switch (name) {
    case 'ccb': return table('ccb', monthly(v(D.ccb), 20), { note: 'Off the 20th?' });
    case 'otb': return table('otb', monthly(v(D.ontarioTrillium), 10), { note: 'Off the 10th?' });
    case 'cppOasGis': return table('cppOasGis', monthly(v(D.cppOasGis)));
    case 'gst': return table('gst', [
      ...v(D.gstCredit).map((d) => ({ date: d, label: MONTHS[parts(d).m - 1], note: 'GST/HST credit' })),
      ...v(D.groceriesEssentials).map((d) => ({ date: d, label: MONTHS[parts(d).m - 1], note: 'Canada Groceries and Essentials Benefit' })),
    ], { first: 'Quarter', note: 'Paid as' });
    default: throw new Error(`unknown region pd:${name}`);
  }
}

const REGION = /(<!-- pd:([A-Za-z0-9]+):start -->)[\s\S]*?(<!-- pd:\2:end -->)/g;
const check = process.argv.includes('--check');
let drift = 0;
for (const file of PAGES) {
  const url = new URL(file, ROOT), html = readFileSync(url, 'utf8');
  const seen = [];
  const out = html.replace(REGION, (m, open, name, close) => { seen.push(name); return open + render(name) + close; });
  if (!seen.length) throw new Error(`${file}: no pd: regions`);
  if (out === html) { console.log(`  ok      ${file} (${seen.join(', ')})`); continue; }
  if (check) { drift++; console.log(`  DRIFT   ${file} — run node scripts/sync-payment-dates.mjs`); }
  else { writeFileSync(url, out); console.log(`  wrote   ${file} (${seen.join(', ')})`); }
}
if (check) {
  console.log(drift ? `\nFAIL — ${drift} page(s) differ from the constants.` : `\nPASS — ${PAGES.length} page(s) match the stamped payment dates.`);
  process.exit(drift ? 1 : 0);
}
