/**
 * test-payroll.mjs — CI gate for /assets/js/payroll-engine.js against CRA's own numbers.
 *
 * 1. PDOC: every case in scripts/fixtures/pdoc-cases.json was run through CRA's Payroll
 *    Deductions Online Calculator (July 2026 rates). The engine must reproduce PDOC's federal
 *    tax, provincial tax, CPP, CPP2, EI, net pay and employer EI to the cent. The 26 'specified'
 *    cases must match exactly. On the 90 'extra' cases PDOC is sometimes one cent higher where
 *    the figure lands on a half cent; that is tolerated only when our unrounded value is within
 *    $0.001 of the half cent, and only up to MAX_TOLERATED cases, so new drift cannot hide. The
 *    engine is the plain T4127 formulas; nothing is tuned to these numbers.
 * 2. T4127 constants: the bracket constants the engine derives (K, KP) must equal the values CRA
 *    publishes in Table 8.1 of the 123rd edition (scripts/fixtures/t4127-jul-2026-table-8-1.json),
 *    for the federal table and all twelve jurisdictions, including BC's and PEI's prorated rows.
 *
 * USAGE  node scripts/test-payroll.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ratesUrl = new URL('data/rates-2026.js', 'file://' + ROOT).href;
const src = readFileSync(ROOT + 'assets/js/payroll-engine.js', 'utf8');
const spec = "'/data/rates-2026.js'";
if (src.split(spec).length !== 2) throw new Error(`payroll-engine.js should import ${spec} exactly once`);
const M = await import('data:text/javascript,' + encodeURIComponent(src.replace(spec, JSON.stringify(ratesUrl))));
const R = await import(ratesUrl);

const fails = [];
let checked = 0;
const MAX_TOLERATED = 4;     // the four known half-cent cases (X-07, V-15, V-24, V-55); more means new drift
const tolerated = [];
const { cases } = JSON.parse(readFileSync(ROOT + 'scripts/fixtures/pdoc-cases.json', 'utf8'));
for (const c of cases) {
  const r = M.payrollDeductions({ code: c.code, pay: c.pay, periods: c.periods, td1Fed: c.td1Fed, td1Prov: c.td1Prov, ytd: c.ytd });
  const ours = { federalTax: r.federalTax, provincialTax: r.provincialTax, cpp: r.cpp, cpp2: r.cpp2, ei: r.ei, net: r.net, employerEi: r.employer.ei };
  // Unrounded per-period tax, to tell a half-cent rounding case from a real error.
  const raw = { federalTax: r.factors.T1 / c.periods, provincialTax: r.factors.T2 / c.periods };
  const halfCent = (k) => k in raw && Math.abs((raw[k] * 100) % 1 - 0.5) * 0.01 < 0.001;
  let caseTolerated = false;
  for (const [k, want] of Object.entries(c.pdoc)) {
    checked++;
    const diff = Math.abs(ours[k] - want);
    if (diff < 0.0001) continue;
    // Extra cases only: a one-cent difference on a tax figure whose unrounded value sits within
    // $0.001 of a half cent, and the net pay that follows from it.
    const taxKey = k === 'net' ? ['federalTax', 'provincialTax'].find((t) => Math.abs(ours[t] - c.pdoc[t]) > 0.0001) : k;
    if (c.set === 'extra' && Math.abs(diff - 0.01) < 0.0001 && taxKey && halfCent(taxKey)) { caseTolerated = true; continue; }
    fails.push(`PDOC  ${c.id} ${k}: PDOC ${want.toFixed(2)}, engine ${ours[k].toFixed(2)}  (${c.set}; ${c.note})`);
  }
  if (caseTolerated) tolerated.push(c.id);
}
if (tolerated.length > MAX_TOLERATED) fails.push(`TOLERANCE  ${tolerated.length} half-cent cases (${tolerated.join(', ')}); at most ${MAX_TOLERATED} allowed`);

const t81 = JSON.parse(readFileSync(ROOT + 'scripts/fixtures/t4127-jul-2026-table-8-1.json', 'utf8'));
const fedK = M.bracketConstants(R.FEDERAL.brackets);
if (JSON.stringify(fedK) !== JSON.stringify(t81.Federal.K)) fails.push(`T4127 federal K ${fedK} !== ${t81.Federal.K}`);
for (const code of M.PAYROLL_JURISDICTIONS) {
  const br = M.payrollBrackets(code);
  const A = br.map((b) => b.min), V = br.map((b) => b.rate), KP = M.bracketConstants(br);
  const t = t81[code];
  if (JSON.stringify(A) !== JSON.stringify(t.A)) fails.push(`T4127 ${code} A ${A} !== ${t.A}`);
  if (JSON.stringify(V) !== JSON.stringify(t.V)) fails.push(`T4127 ${code} V ${V} !== ${t.V}`);
  if (JSON.stringify(KP) !== JSON.stringify(t.KP)) fails.push(`T4127 ${code} KP ${KP} !== ${t.KP}`);
}
if (JSON.stringify(R.PAYROLL.BC.kp) !== JSON.stringify(t81.BC.KP)) fails.push(`stamped BC KP ${R.PAYROLL.BC.kp} !== T4127 ${t81.BC.KP}`);
if (R.PAYROLL.PE.topKp !== t81.PE.KP.at(-1)) fails.push(`stamped PE top KP ${R.PAYROLL.PE.topKp} !== T4127 ${t81.PE.KP.at(-1)}`);

console.log('payroll engine check — T4127 Option 1 against CRA PDOC and Table 8.1');
console.log(`${cases.length} PDOC cases (${cases.filter((c) => c.set === 'specified').length} specified, exact), ${checked} figures; Table 8.1 constants for federal + ${M.PAYROLL_JURISDICTIONS.length} jurisdictions`);
console.log(`half-cent cases tolerated at ±$0.01: ${tolerated.length} of ${MAX_TOLERATED} allowed${tolerated.length ? ' (' + tolerated.join(', ') + ')' : ''}`);
if (fails.length) { console.log(`${fails.length} MISMATCH(ES):\n` + fails.map((f) => '  ' + f).join('\n')); process.exitCode = 1; }
else console.log(`PASS — every PDOC figure matches to the cent${tolerated.length ? ` (bar ${tolerated.length} tolerated half-cent case${tolerated.length === 1 ? '' : 's'})` : ''}, and every derived K/KP equals Table 8.1.`);
