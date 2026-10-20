/**
 * check-faq-parity.mjs — CI gate: every page's FAQPage JSON-LD says exactly what its visible FAQ
 * says, question for question and answer for answer, in the same order.
 *
 * WHY
 *   Google's FAQ structured-data guidelines require the marked-up questions and answers to be the
 *   ones visible on the page. Until 2026-10-20 many older pages carried JSON-LD answers that were
 *   paraphrases of the visible ones — longer, shorter, sometimes asking different questions — and
 *   nothing checked. check-schema only looks for retired figures; check-prose-figures checks each
 *   surface against the constants, not against each other. This compares the two surfaces.
 *
 * WHAT COUNTS AS THE VISIBLE FAQ
 *   Every <details><summary>QUESTION</summary>ANSWER</details> inside the page's <main>. The site
 *   uses <details> for FAQs only. The answer is everything after the summary, as plain text.
 *
 * NORMALISATION (both sides)
 *   Tags removed (inline tags with no gap, other tags replaced by a space), entities decoded,
 *   whitespace collapsed. So a visible answer with a link or a list is matched by its plain-text
 *   equivalent in the JSON-LD.
 *
 * WHAT FAILS (exit 1)
 *   COUNT      the JSON-LD and the page have a different number of questions
 *   QUESTION   question N differs
 *   ANSWER     answer N differs (the first differing position is shown)
 *   NO-LD      a page shows an FAQ with no FAQPage JSON-LD, or the reverse
 *   INVALID    an ld+json block does not parse
 *   SELF-TEST  the built-in self-test below did not behave
 *
 * USAGE
 *   node scripts/check-faq-parity.mjs
 *   import { visibleFaq, ldFaq, compare } from './check-faq-parity.mjs'   (the sync uses these)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeEntities } from './check-prose-figures.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const INLINE = 'a|abbr|b|bdi|cite|code|data|dfn|em|i|kbd|mark|q|s|small|span|strong|sub|sup|time|u|var';
const squash = (s) => s.replace(/[\s    ]+/g, ' ').trim();
export const plain = (html) => squash(decodeEntities(
  html.replace(new RegExp(`</?(?:${INLINE})(?:\\s[^>]*)?>`, 'gi'), '').replace(/<[^>]+>/g, ' ')));

/** [[question, answer], …] from the <details> blocks inside <main>. */
export function visibleFaq(html) {
  const main = (html.match(/<main\b[\s\S]*?<\/main>/i) || [''])[0]
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  return [...main.matchAll(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)]
    .map((m) => [plain(m[1]), plain(m[2])]);
}

/** [[question, answer], …] from the page's FAQPage JSON-LD, or null if it has none. Throws on a
 *  block that does not parse. */
export function ldFaq(html) {
  let found = null;
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const json = JSON.parse(m[1]);
    for (const node of Array.isArray(json) ? json : json['@graph'] ?? [json]) {
      if (node?.['@type'] === 'FAQPage') {
        found = (node.mainEntity ?? []).map((q) => [plain(q.name ?? ''), plain(q.acceptedAnswer?.text ?? '')]);
      }
    }
  }
  return found;
}

const firstDiff = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };
const around = (s, i) => `…${s.slice(Math.max(0, i - 30), i + 40)}…`;

/** Failure strings for one page's HTML (empty if it matches or has no FAQ at all). */
export function compare(html, where = 'page') {
  let ld;
  try { ld = ldFaq(html); } catch (e) { return [`INVALID    ${where}: ld+json does not parse — ${e.message}`]; }
  const vis = visibleFaq(html);
  if (!ld && !vis.length) return [];
  if (!ld) return [`NO-LD      ${where}: ${vis.length} visible FAQ question(s) but no FAQPage JSON-LD`];
  if (!vis.length) return [`NO-LD      ${where}: FAQPage JSON-LD with ${ld.length} question(s) but no visible FAQ`];
  const out = [];
  if (ld.length !== vis.length) out.push(`COUNT      ${where}: JSON-LD has ${ld.length} question(s), the page shows ${vis.length}`);
  for (let i = 0; i < Math.min(ld.length, vis.length); i++) {
    const [lq, la] = ld[i], [vq, va] = vis[i];
    if (lq !== vq) out.push(`QUESTION   ${where} #${i + 1}: JSON-LD "${lq}" ≠ visible "${vq}"`);
    if (la !== va) {
      const d = firstDiff(la, va);
      out.push(`ANSWER     ${where} #${i + 1} ("${vq}"): differs at character ${d}\n             JSON-LD ${around(la, d)}\n             visible ${around(va, d)}`);
    }
  }
  return out;
}

/* ── built-in self-test ─────────────────────────────────────────────────────── */
export function selfTest() {
  const errs = [];
  const page = (ld, body) => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><main>${body}</main></body></html>`;
  const q = (name, text) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } });
  const goodLd = { '@type': 'FAQPage', mainEntity: [q('How much?', 'Up to $762.50 a month, see the calculator.'), q('When?', 'Monthly.')] };
  const body = '<details><summary>How much?</summary><p>Up to <strong>$762.50</strong> a month, see the <a href="/x/">calculator</a>.</p></details>'
    + '<details><summary>When?</summary>\n  <p>Monthly.</p></details>';
  const expect = (label, html, kind) => {
    const r = compare(html, 't');
    if (kind === null ? r.length : !r.some((x) => x.startsWith(kind))) errs.push(`self-test: ${label} → ${r.join(' | ') || 'a pass'}`);
  };
  expect('a matching page passes (links, strong, whitespace normalised)', page(goodLd, body), null);
  const cl = () => JSON.parse(JSON.stringify(goodLd));
  let x = cl(); x.mainEntity[0].acceptedAnswer.text = 'Up to $751.97 a month, see the calculator.';
  expect('a changed JSON-LD answer', page(x, body), 'ANSWER');
  x = cl(); x.mainEntity[1].name = 'When is it paid?';
  expect('a changed JSON-LD question', page(x, body), 'QUESTION');
  x = cl(); x.mainEntity.pop();
  expect('a dropped JSON-LD question', page(x, body), 'COUNT');
  expect('a changed visible answer', page(goodLd, body.replace('Monthly.', 'Every month.')), 'ANSWER');
  expect('a visible FAQ with no JSON-LD', `<html><main>${body}</main></html>`, 'NO-LD');
  expect('a broken ld+json block', page(goodLd, body).replace('"FAQPage"', 'FAQPage'), 'INVALID');
  x = cl(); x.mainEntity.reverse();
  expect('reordered questions', page(x, body), 'QUESTION');
  return errs;
}

/* ── main ───────────────────────────────────────────────────────────────────── */
function pages(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules' || name === 'worker' || name === 'scripts') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (process.argv?.[1]?.endsWith('check-faq-parity.mjs')) {
  const files = pages().sort();
  let withFaq = 0, questions = 0;
  const failures = [];
  for (const f of files) {
    const html = readFileSync(f, 'utf8'), rel = relative(ROOT, f);
    const vis = visibleFaq(html);
    if (vis.length) { withFaq++; questions += vis.length; }
    failures.push(...compare(html, rel));
  }
  const selfErrs = selfTest();
  console.log('FAQ parity check — FAQPage JSON-LD against the FAQ visible on each page');
  console.log(`${withFaq} page(s) with an FAQ, ${questions} question(s); self-test: ${selfErrs.length ? 'FAIL' : 'ok'}\n`);
  const all = [...failures, ...selfErrs];
  if (all.length) console.log(`${all.length} ISSUE(S):\n` + all.map((x) => `  ${x}`).join('\n'));
  else console.log(`PASS — every FAQPage block matches its page's visible FAQ word for word.`);
  process.exit(all.length ? 1 : 0);
}
