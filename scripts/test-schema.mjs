/**
 * test-schema.mjs — NEGATIVE tests for scripts/check-schema.mjs.
 *
 * WHY THIS FILE EXISTS
 *   check-schema ships green, and today it ships green partly because constant-history.json
 *   holds no superseded rows yet — so a passing run proves almost nothing about whether the
 *   RETIRED rule would ever fire. These tests supply synthetic history and synthetic pages,
 *   corrupt them in every way the rule is meant to catch, and assert it fires — and, just as
 *   important, that it stays QUIET where firing would be a false alarm.
 *
 *   Without this, the gate could rot into a permanent no-op and every CI run would stay
 *   green, which is the exact failure the gate was built to prevent elsewhere.
 *
 * USAGE
 *   node scripts/test-schema.mjs
 * Exits 1 if any assertion fails to fire when it should, or fires when it should not.
 * Reads the real repo only for the "real data is clean" case; writes nothing.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, htmlFiles, valueSets, figureTokens, canonicalise, keysForNumber } from './check-schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const t = (name, actual, expected) => {
  results.push({ name, ok: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
};

/** A page carrying one ld+json block with `body` as its FAQ answer text. */
const page = (body) => ({
  path: 'synthetic/index.html',
  html: `<html><head>\n<script type="application/ld+json">\n${
    JSON.stringify({ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'q', acceptedAnswer: { '@type': 'Answer', text: body } }] })
  }\n</script>\n</head><body><p>${body}</p></body></html>`,
});

/** History with ei.repaymentThreshold moved 79000 -> 86125: the real eicalc.ca defect. */
const HIST = [
  { key: 'ei.repaymentThreshold', value: 79000, effective_from: '2024-01-01', effective_to: '2026-01-01', source_url: 'u', verified_at: '2024-01-01', cadence: 'january' },
  { key: 'ei.repaymentThreshold', value: 86125, effective_from: '2026-01-01', effective_to: null, source_url: 'u', verified_at: '2026-08-16', cadence: 'january' },
  { key: 'ei.rate', value: 0.0155, effective_from: '2024-01-01', effective_to: '2026-01-01', source_url: 'u', verified_at: '2024-01-01', cadence: 'january' },
  { key: 'ei.rate', value: 0.0163, effective_from: '2026-01-01', effective_to: null, source_url: 'u', verified_at: '2026-08-16', cadence: 'january' },
  { key: 'cpp.basicExemption', value: 3500, effective_from: '2024-01-01', effective_to: '2026-01-01', source_url: 'u', verified_at: '2024-01-01', cadence: 'january' },
  { key: 'cpp.basicExemption', value: 3500, effective_from: '2026-01-01', effective_to: null, source_url: 'u', verified_at: '2026-08-16', cadence: 'january' },
  { key: 'cpp.generalDropoutMaxYears', value: 8, effective_from: '2026-01-01', effective_to: null, source_url: 'u', verified_at: '2026-08-16', cadence: 'january' },
];
const only = (list, prefix) => list.filter((x) => x.startsWith(prefix));

/* ── the real repo must be clean ─────────────────────────────────────────────── */
{
  const history = JSON.parse(readFileSync(join(ROOT, 'data/constant-history.json'), 'utf8'));
  const files = htmlFiles().map((p) => ({ path: p, html: readFileSync(join(ROOT, p), 'utf8') }));
  t('real repo: no failures', check({ files, history }).failures.length, 0);
  t('real repo: every ld+json block parses', only(check({ files, history }).failures, 'INVALID').length, 0);
}

/* ── RETIRED fires ───────────────────────────────────────────────────────────── */
t('the actual eicalc.ca defect ($79,000 in schema) fires',
  only(check({ files: [page('If your income exceeds $79,000 you repay 30%.')], history: HIST }).failures, 'RETIRED').length, 1);

t('retired token with trailing punctuation still fires',
  only(check({ files: [page('exceeds $79,000, you repay.')], history: HIST }).failures, 'RETIRED').length, 1);

// Documented limitation, asserted so it stays deliberate: bare integers are not tokens.
// Only $-prefixed / %-suffixed figures are scanned, so counts (41 rows, 420 hours, 8 years)
// cannot collide with a retired value. See the FIGURE_RE comment in check-schema.mjs.
t('a bare integer is deliberately NOT tokenised',
  only(check({ files: [page('exceeds 79000 dollars.')], history: HIST }).failures, 'RETIRED').length, 0);

t('retired PERCENT (1.55%) fires',
  only(check({ files: [page('Premiums are 1.55% of insurable earnings.')], history: HIST }).failures, 'RETIRED').length, 1);

t('two retired figures in one block report twice',
  only(check({ files: [page('$79,000 and 1.55% both stale.')], history: HIST }).failures, 'RETIRED').length, 2);

t('failure message names the key and the current value',
  only(check({ files: [page('exceeds $79,000.')], history: HIST }).failures, 'RETIRED')[0]
    .includes('ei.repaymentThreshold') &&
  only(check({ files: [page('exceeds $79,000.')], history: HIST }).failures, 'RETIRED')[0]
    .includes('86125'), true);

/* ── RETIRED stays quiet where firing would be wrong ─────────────────────────── */
t('the CURRENT value does not fire',
  only(check({ files: [page('If your income exceeds $86,125 you repay 30%.')], history: HIST }).failures, 'RETIRED').length, 0);

t('a value retired by one key but still current elsewhere does not fire',
  only(check({ files: [page('The first $3,500 each year is exempt.')], history: HIST }).failures, 'RETIRED').length, 0);

t('an untracked worked-example figure does not fire',
  only(check({ files: [page('55% of $900 is $495, so $9,900 over 20 weeks.')], history: HIST }).failures, 'RETIRED').length, 0);

t('a retired value in VISIBLE PROSE but not in ld+json does not fire',
  only(check({ files: [{ path: 'p/index.html', html: '<html><body><p>exceeds $79,000</p></body></html>' }], history: HIST }).failures, 'RETIRED').length, 0);

t('a whole-number pack value is never read as a percent (8 vs 8%)',
  only(check({ files: [page('Self-employed pay 8% on the second tier.')], history: HIST }).failures, 'RETIRED').length, 0);

t('money and percent are not interchangeable ($1.55 is not 1.55%)',
  only(check({ files: [page('A fee of $1.55 applies.')], history: HIST }).failures, 'RETIRED').length, 0);

t('empty history means no RETIRED failures',
  only(check({ files: [page('exceeds $79,000.')], history: [] }).failures, 'RETIRED').length, 0);

/* ── VALID fires ─────────────────────────────────────────────────────────────── */
t('a malformed ld+json block fires INVALID',
  only(check({ files: [{ path: 'b/index.html', html: '<script type="application/ld+json">{"a":,}</script>' }], history: HIST }).failures, 'INVALID').length, 1);

t('a malformed block is not ALSO scanned for figures (no double report)',
  check({ files: [{ path: 'b/index.html', html: '<script type="application/ld+json">{bad $79,000</script>' }], history: HIST }).failures.length, 1);

t('a page with no ld+json produces no failures and does not throw',
  check({ files: [{ path: 'n/index.html', html: '<html><body>no schema here $79,000</body></html>' }], history: HIST }).failures.length, 0);

/* ── unit-level behaviour the rules rest on ──────────────────────────────────── */
t('canonicalise: $68,900 and 68900 agree', canonicalise('$68,900') === canonicalise('68900'), true);
t('canonicalise: percent is a distinct namespace', canonicalise('55%') !== canonicalise('55'), true);
t('keysForNumber: decimal fraction yields a percent key', keysForNumber(0.0163).includes('pct:1.63'), true);
t('keysForNumber: whole number yields no percent key', keysForNumber(8).some((k) => k.startsWith('pct:')), false);
t('figureTokens: trailing comma is excluded from the token', figureTokens('$79,000, and')[0]?.raw, '$79,000');
t('numbersIn via valueSets: nested bracket values are tracked',
  valueSets([{ key: 'f.brackets', value: [{ min: 0, max: 58523, rate: 0.14 }], effective_to: '2026-01-01' }])
    .retired.has('money:58523'), true);

/* ── report ──────────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
const lines = ['check-schema negative tests', ''];
for (const r of results) {
  lines.push(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}` +
    (r.ok ? '' : `  (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
}
lines.push('');
lines.push(failed.length
  ? `${failed.length} of ${results.length} FAILED — check-schema is not doing its job.`
  : `PASS — all ${results.length} cases: the RETIRED and INVALID rules fire on corrupt input and stay quiet on valid input.`);
console.log(lines.join('\n'));
process.exitCode = failed.length ? 1 : 0;
