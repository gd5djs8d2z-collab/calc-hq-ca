/**
 * check-prose-figures.mjs — CI gate: every registered figure quoted in page copy equals the
 * stamped value (or engine result) it restates.
 *
 * THE HOLE THIS CLOSES
 *   Page prose and FAQ JSON-LD restate figures as literals; nothing fills them at runtime. On
 *   2026-10-03 the OAS/GIS/CPP pages quoted last quarter's amounts while their calculators ran on
 *   the new ones, and every gate was green: check-constants proves a value was cited and is in
 *   date, check-history proves the audit trail is kept, check-schema catches a JSON-LD figure only
 *   once the pack is on record as having moved off it. None of them ties a figure in the copy to
 *   the value it is supposed to equal. This does — for the figures in data/prose-figures.json.
 *
 * THE REGISTRY (data/prose-figures.json)
 *   pages    — the in-scope page paths. The ratchet (below) scans exactly these.
 *   figures  — one entry per quoted figure, per surface:
 *     page     "/benefits/oas/"                     (served path; file is <path>index.html)
 *     surface  "main" | "jsonld"                   which text the anchor is searched in
 *     anchor   "the maximum is {} a month at ages"  exact surrounding text. {} marks THE figure,
 *              {*} matches any other figure (so a neighbouring figure in a table row can drift
 *              without masking this one). Must match EXACTLY ONCE in that surface.
 *     source   {"const": "oas.maxMonthly65to74"}   a path into TAX_CONSTANTS_2026 (stamped data;
 *                                                  .value is stepped through automatically), or
 *              {"engine": "OAS.maxMonthly65to74 * OAS.deferralFactor(70)"}
 *                                                  an expression over the engine exports with
 *                                                  fixed inputs, for derived figures
 *     format   "exact"      money, equal to the cent
 *              "round:N"    money rounded to the nearest N ("about $8,300" -> round:100)
 *              "percent"    source is a fraction (0.0595), copy shows 5.95%
 *              "percent:D"  same, copy rounds to D decimals
 *     note     optional, free text
 *
 * SURFACES — how the text is normalised before anchors are matched
 *   main    the page's <main> element with <script>/<style>/comments removed; inline tags
 *           (strong, a, span, …) removed with no gap, every other tag replaced by one space,
 *           entities decoded, whitespace collapsed. So "<td>66</td><td>7.2%</td>" reads
 *           "66 7.2%" and "<strong>$762.50</strong>." reads "$762.50.".
 *   jsonld  every string value of every application/ld+json block, joined with " ¶ " so no
 *           anchor can straddle two strings. A block that does not parse is a failure.
 *
 * WHAT FAILS (exit 1)
 *   MISMATCH   the figure at the anchor differs from the source after the format rule
 *   MISSING    the anchor is not in that surface — edited copy cannot silently leave the check
 *   AMBIGUOUS  the anchor matches more than once
 *   KIND       a money format found a % figure, or vice versa
 *   CONFIG     malformed entry, page not in scope, const path not a number, engine error
 *   SELF-TEST  the built-in self-test below did not behave
 *
 * RATCHET (warning only in v1)
 *   Every $ / % figure on an in-scope page, in either surface, that no registry entry covers is
 *   listed in data/prose-figures-unregistered.txt and counted in the report. It does not fail
 *   the run. Burn it down by registering constant-derived figures.
 *
 * ENGINE LOADING
 *   Expressions see every export of data/rates-2026.js and assets/js/tax-engine.js, plus TC
 *   (= TAX_CONSTANTS_2026). tax-engine.js imports '/data/rates-2026.js' as a site-absolute path,
 *   which Node would resolve against the filesystem root, so that ONE specifier is rewritten in
 *   memory to the repo file's URL before import. The engine file itself is not modified, and the
 *   rewrite must hit exactly once or the run fails — a renamed import cannot degrade silently.
 *
 * USAGE
 *   node scripts/check-prose-figures.mjs [--verbose] [--no-write]
 *   --verbose   also print every passing entry
 *   --no-write  do not rewrite the ratchet file (used by tests)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { figureTokens } from './check-schema.mjs';

const ROOT_URL = new URL('../', import.meta.url);
const REGISTRY_PATH = new URL('data/prose-figures.json', ROOT_URL);
const RATCHET_PATH = new URL('data/prose-figures-unregistered.txt', ROOT_URL);

/* ── text extraction ────────────────────────────────────────────────────────────────────── */

const INLINE = 'a|abbr|b|bdi|cite|code|data|dfn|em|i|kbd|mark|q|s|small|span|strong|sub|sup|time|u|var';
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', thinsp: ' ', ensp: ' ', emsp: ' ',
  ndash: '–', mdash: '—', minus: '−', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  hellip: '…', times: '×', divide: '÷', middot: '·', rarr: '→', larr: '←', le: '≤', ge: '≥',
  asymp: '≈', frac12: '½', deg: '°', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è',
  agrave: 'à', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', copy: '©', reg: '®', trade: '™',
};
export const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]\w*);/gi, (m, e) =>
  e[0] === '#'
    ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    : (ENTITIES[e] ?? m));
const squash = (s) => s.replace(/[\s  ]+/g, ' ').trim();

/** The page's <main>, as a reader sees it. */
export function mainText(html) {
  let m = (html.match(/<main\b[\s\S]*?<\/main>/i) || [''])[0];
  m = m.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  m = m.replace(new RegExp(`</?(?:${INLINE})(?:\\s[^>]*)?>`, 'gi'), '').replace(/<[^>]+>/g, ' ');
  return squash(decodeEntities(m));
}

/** Every string in every ld+json block. Throws on a block that does not parse. */
export function jsonldText(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const json = JSON.parse(m[1]);
    (function walk(v) {
      if (typeof v === 'string') out.push(squash(decodeEntities(v)));
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    })(json);
  }
  return out.join(' ¶ ');
}

/* ── anchors, sources, formats ──────────────────────────────────────────────────────────── */

const FIG = String.raw`\$\s?\d(?:[\d,]*\d)?(?:\.\d+)?|\d(?:[\d,]*\d)?(?:\.\d+)?\s?%`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function anchorRegex(anchor) {
  const parts = anchor.split(/(\{\}|\{\*\})/);
  return new RegExp(parts.map((p) =>
    p === '{}' ? `(${FIG})` : p === '{*}' ? `(?:${FIG})` : escapeRe(p)).join(''), 'gd');
}

/** Resolve "a.b.c" in the stamped tree, stepping through each stamped record's .value. */
export function resolveConst(tree, path) {
  let node = tree;
  for (const seg of path.split('.')) {
    if (node && typeof node === 'object' && 'value' in node && !(seg in node)) node = node.value;
    if (node == null || typeof node !== 'object' || !(seg in node)) return undefined;
    node = node[seg];
  }
  if (node && typeof node === 'object' && 'value' in node) node = node.value;
  return node;
}

const parseFigure = (raw) => Number(raw.replace(/[$%,\s]/g, ''));
const money = (n) => '$' + n.toLocaleString('en-CA', {
  minimumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 });
const round = (n, d) => Number(n.toFixed(d));

/** Expected figure for a value under a format rule: { n, text, percent } or { error }. */
export function expectedFor(value, format) {
  let m;
  if (format === 'exact') return { n: round(value, 2), text: money(round(value, 2)), percent: false };
  if ((m = /^round:(\d+(?:\.\d+)?)$/.exec(format))) {
    const step = Number(m[1]);
    const n = round(Math.round(value / step) * step, 2);
    return { n, text: money(n), percent: false };
  }
  if ((m = /^percent(?::(\d))?$/.exec(format))) {
    const n = round(value * 100, m[1] === undefined ? 6 : Number(m[1]));
    return { n, text: `${n}%`, percent: true };
  }
  return { error: `unknown format "${format}"` };
}

/* ── the check ──────────────────────────────────────────────────────────────────────────── */

const pageFile = (page) => `${page.replace(/^\//, '')}index.html`;

/**
 * Pure core. registry = parsed JSON; readPage(path) -> html; ctx = { TC, scope } where scope is
 * the name->value map engine expressions are evaluated against.
 */
export function check({ registry, readPage, ctx }) {
  const failures = [], passes = [];
  const pages = new Set(registry.pages);
  const surfaces = new Map();                 // page -> { main, jsonld } (text or Error)
  const covered = new Map();                  // `${page}|${surface}` -> Set of capture offsets

  const surfaceOf = (page) => {
    if (!surfaces.has(page)) {
      const html = readPage(pageFile(page));
      let ld;
      try { ld = jsonldText(html); } catch (e) { ld = new Error(`ld+json does not parse — ${e.message}`); }
      surfaces.set(page, { main: mainText(html), jsonld: ld });
    }
    return surfaces.get(page);
  };
  for (const page of pages) {
    try {
      const s = surfaceOf(page);
      if (s.jsonld instanceof Error) failures.push(`CONFIG     ${page} [jsonld] ${s.jsonld.message}`);
    } catch (e) { failures.push(`CONFIG     ${page}: cannot read ${pageFile(page)} — ${e.message}`); }
  }

  const names = Object.keys(ctx.scope);
  const evaluate = (expr) => new Function(...names, `"use strict"; return (${expr});`)(...names.map((k) => ctx.scope[k]));

  registry.figures.forEach((f, i) => {
    const where = `${f.page} [${f.surface}] "${f.anchor}"`;
    const bad = (msg) => failures.push(`CONFIG     #${i} ${where}: ${msg}`);
    if (!pages.has(f.page)) return bad('page is not in registry.pages');
    if (f.surface !== 'main' && f.surface !== 'jsonld') return bad(`surface must be "main" or "jsonld"`);
    if (typeof f.anchor !== 'string' || f.anchor.split('{}').length !== 2) return bad('anchor must contain exactly one {}');
    if (/\$\{\}|\{\}\s?%/.test(f.anchor)) return bad('put the $ / % inside {}, not in the anchor text');
    const src = f.source || {};
    if (('const' in src) === ('engine' in src)) return bad('source needs exactly one of "const" or "engine"');

    let value;
    try { value = 'const' in src ? resolveConst(ctx.TC, src.const) : evaluate(src.engine); }
    catch (e) { return bad(`engine expression threw — ${e.message}`); }
    if (typeof value !== 'number' || !Number.isFinite(value)) return bad(`source ${JSON.stringify(src)} is not a finite number (got ${JSON.stringify(value)})`);
    const exp = expectedFor(value, f.format);
    if (exp.error) return bad(exp.error);

    let text;
    try { text = surfaceOf(f.page)[f.surface]; } catch { return; }       // already reported above
    if (text instanceof Error) return;                                    // already reported above
    const hits = [...text.matchAll(anchorRegex(f.anchor))];
    if (hits.length === 0) return failures.push(`MISSING    ${where}: anchor not found`);
    if (hits.length > 1) return failures.push(`AMBIGUOUS  ${where}: anchor matches ${hits.length} times`);

    const raw = hits[0][1].trim();
    const start = hits[0].indices[1][0];
    const key = `${f.page}|${f.surface}`;
    if (!covered.has(key)) covered.set(key, new Set());
    covered.get(key).add(start);

    const srcLabel = 'const' in src ? src.const : src.engine;
    if (raw.includes('%') !== exp.percent) {
      return failures.push(`KIND       ${where}: found ${raw}, but format "${f.format}" expects a ${exp.percent ? 'percentage' : 'dollar figure'}`);
    }
    const found = parseFigure(raw);
    if (Math.abs(found - exp.n) > 1e-9) {
      const shown = exp.percent ? exp.text : '$' + exp.n.toLocaleString('en-CA', {     // print it the way the copy does
        minimumFractionDigits: raw.includes('.') ? 2 : 0, maximumFractionDigits: 2 });
      return failures.push(`MISMATCH   ${where}: found ${raw}, expected ${shown}  (${srcLabel} = ${value}, ${f.format})`);
    }
    passes.push(`ok         ${where}: ${raw}  (${srcLabel}, ${f.format})`);
  });

  // Ratchet: every figure token on an in-scope page that no entry covers.
  const unregistered = [];
  for (const page of pages) {
    let s; try { s = surfaceOf(page); } catch { continue; }
    for (const surface of ['main', 'jsonld']) {
      const text = s[surface];
      if (typeof text !== 'string') continue;
      const cov = covered.get(`${page}|${surface}`) || new Set();
      for (const tok of figureTokens(text)) {
        if (cov.has(tok.index)) continue;
        const ctxText = text.slice(Math.max(0, tok.index - 60), tok.index) + '⟦' + tok.raw + '⟧' +
          text.slice(tok.index + tok.raw.length, tok.index + tok.raw.length + 40);
        unregistered.push(`${page}\t${surface}\t${tok.raw}\t…${ctxText}…`);
      }
    }
  }
  return { failures, passes, unregistered };
}

/* ── built-in self-test ─────────────────────────────────────────────────────────────────── */

/**
 * Runs check() over a synthetic page + registry and proves each failure mode actually fires —
 * a green run of the real registry says nothing about whether the gate CAN fail. Returns [] on
 * success, or failure strings.
 */
export function selfTest() {
  const errs = [];
  const page = (body, ld) => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head>` +
    `<body><nav>$1 nav</nav><main><p>Max is <strong>$762.50</strong> a month.</p>` +
    `<table><tr><td>70</td><td>36%</td><td>$1,037.00</td></tr></table>${body}</main></body></html>`;
  const goodLd = { '@type': 'FAQPage', mainEntity: [{ acceptedAnswer: { text: 'Up to $762.50 a month, about $8,300 a year.' } }] };
  const TC = { oas: { max: { value: 762.5, source_url: 'x', last_verified: 'x' }, rate: { value: 0.006, source_url: 'x', last_verified: 'x' } } };
  const registry = {
    pages: ['/t/'],
    figures: [
      { page: '/t/', surface: 'main', anchor: 'Max is {} a month.', source: { const: 'oas.max' }, format: 'exact' },
      { page: '/t/', surface: 'main', anchor: '70 {} {*}', source: { engine: 'TC.oas.rate.value * 60' }, format: 'percent' },
      { page: '/t/', surface: 'main', anchor: '70 {*} {}', source: { engine: 'TC.oas.max.value * (1 + TC.oas.rate.value * 60)' }, format: 'exact' },
      { page: '/t/', surface: 'jsonld', anchor: 'Up to {} a month', source: { const: 'oas.max' }, format: 'exact' },
      { page: '/t/', surface: 'jsonld', anchor: 'about {} a year', source: { engine: 'TC.oas.max.value * 10.9' }, format: 'round:100' },
    ],
  };
  const run = ({ html = page('', goodLd), tc = TC, reg = registry } = {}) =>
    check({ registry: reg, readPage: () => html, ctx: { TC: tc, scope: { TC: tc } } });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const expectFail = (label, res, kind) => {
    if (!res.failures.some((f) => f.startsWith(kind))) errs.push(`self-test: ${label} did not produce ${kind} (got ${res.failures.join(' | ') || 'a pass'})`);
  };

  const base = run();
  if (base.failures.length) errs.push(`self-test: clean synthetic page should pass — ${base.failures.join(' | ')}`);
  if (base.unregistered.length !== 0) errs.push(`self-test: ratchet should be empty on the clean page (got ${base.unregistered.length}; nav must be out of scope)`);

  const tc2 = clone(TC); tc2.oas.max.value = 770;
  expectFail('changing a stamped value', run({ tc: tc2 }), 'MISMATCH');
  expectFail('changing a prose figure', run({ html: page('', goodLd).replace('<strong>$762.50</strong>', '<strong>$751.97</strong>') }), 'MISMATCH');
  expectFail('deleting an anchor', run({ html: page('', goodLd).replace('Max is', 'The most is') }), 'MISSING');
  const ld2 = clone(goodLd); ld2.mainEntity[0].acceptedAnswer.text = 'Up to $751.97 a month, about $8,300 a year.';
  expectFail('editing only the JSON-LD', run({ html: page('', ld2) }), 'MISMATCH');
  expectFail('a duplicated anchor', run({ html: page('<p>Max is $762.50 a month.</p>', goodLd) }), 'AMBIGUOUS');
  expectFail('a rounded figure off by one step', run({ html: page('', { ...goodLd, mainEntity: [{ acceptedAnswer: { text: 'Up to $762.50 a month, about $8,400 a year.' } }] }) }), 'MISMATCH');
  expectFail('a broken ld+json block', run({ html: page('', goodLd).replace('"FAQPage"', 'FAQPage') }), 'CONFIG');
  const reg2 = clone(registry); reg2.figures[0].source = { const: 'oas.nope' };
  expectFail('an unresolvable const path', run({ reg: reg2 }), 'CONFIG');
  const reg3 = clone(registry); reg3.figures[1].format = 'exact';
  expectFail('a % figure under a money format', run({ reg: reg3 }), 'KIND');
  const extra = run({ html: page('<p>Unregistered $99 and 4%.</p>', goodLd) });
  if (extra.unregistered.length !== 2) errs.push(`self-test: ratchet should list exactly the 2 unregistered figures (got ${extra.unregistered.length})`);
  return errs;
}

/* ── main ───────────────────────────────────────────────────────────────────────────────── */

export async function loadContext() {
  const ratesUrl = new URL('data/rates-2026.js', ROOT_URL).href;
  const rates = await import(ratesUrl);
  const { TAX_CONSTANTS_2026: TC } = await import(new URL('data/tax-constants-2026.js', ROOT_URL).href);
  const src = readFileSync(new URL('assets/js/tax-engine.js', ROOT_URL), 'utf8');
  const spec = "'/data/rates-2026.js'";
  if (src.split(spec).length !== 2) throw new Error(`tax-engine.js should import ${spec} exactly once — loader rewrite would not be faithful`);
  const engine = await import('data:text/javascript,' + encodeURIComponent(src.replace(spec, JSON.stringify(ratesUrl))));
  return { TC, scope: { ...rates, ...engine, TC } };
}

async function main() {
  const verbose = process.argv.includes('--verbose');
  const write = !process.argv.includes('--no-write');
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  const ctx = await loadContext();
  const { failures, passes, unregistered } = check({
    registry, ctx, readPage: (f) => readFileSync(new URL(f, ROOT_URL), 'utf8'),
  });
  const selfErrs = selfTest();

  if (write) {
    writeFileSync(RATCHET_PATH, [
      '# Figures on in-scope pages that no entry in data/prose-figures.json covers.',
      '# Generated by scripts/check-prose-figures.mjs — do not edit by hand. Burn it down by',
      '# registering every figure here that restates a stamped constant (MAINTENANCE.md, Rule 6).',
      '# page\tsurface\tfigure\tcontext',
      ...unregistered, ''].join('\n'));
  }

  const lines = [
    'prose figure check — figures quoted in page copy against the stamped values they restate',
    `${registry.figures.length} registered figures on ${registry.pages.length} pages: ` +
      `${passes.length} match, ${failures.length} issue(s)`,
    `self-test: ${selfErrs.length ? 'FAIL' : 'ok'} (stamped-value change, prose change, deleted anchor, ` +
      'JSON-LD-only edit, duplicate anchor, rounding, broken block, bad path, wrong kind — each must fail)',
    `RATCHET (warning): ${unregistered.length} figure(s) on in-scope pages are not registered` +
      (write ? ' — listed in data/prose-figures-unregistered.txt' : ''),
    '',
  ];
  if (verbose) lines.push(...passes, '');
  const all = [...failures, ...selfErrs];
  if (all.length) lines.push(`${all.length} ISSUE(S):`, ...all.map((f) => `  ${f}`));
  else lines.push(`PASS — all ${passes.length} registered figures match their source.`);
  console.log(lines.join('\n'));
  return all.length ? 1 : 0;
}

if (process.argv?.[1]?.endsWith('check-prose-figures.mjs')) {
  process.exitCode = await main();
}
