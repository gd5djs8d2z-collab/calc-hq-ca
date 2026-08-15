/**
 * check-redirects.mjs — CI gate for _redirects, the Cloudflare redirect table.
 *
 * _redirects is the one file where a typo silently takes a live page off the internet:
 * Cloudflare follows redirects "regardless of whether or not an asset matches the incoming
 * request", so a rule whose SOURCE is a real page shadows that page permanently. Nothing
 * else in CI looks at this file, and a shadowed page still returns HTTP 200 — just of the
 * wrong document — so it cannot be caught by a link checker either.
 *
 * It asserts, against sitemap.xml as the list of canonical live pages:
 *   1. SHADOW    — no rule's source is a canonical page URL (would hide a live page),
 *   2. SELF      — no rule points at itself (infinite loop),
 *   3. CHAIN     — no rule's target is another rule's source (301 -> 301, drops link equity),
 *   4. RESERVED  — no rule's source is /sitemap.xml, /robots.txt, /ads.txt or under /assets/,
 *   5. COVERAGE  — every canonical page has a trailing-slash 301 from its extensionless form,
 *   6. TARGET    — every rule's target is a canonical page URL or a real file in the repo.
 *
 * WHY COVERAGE IS ENUMERATED AND NOT A WILDCARD
 *   assets.html_handling = "auto-trailing-slash" (wrangler.jsonc) already sends /about to
 *   /about/, but with a 307 — temporary, so it neither consolidates the URL nor passes link
 *   equity. _redirects has no regex, and its only matching wildcard (/* -> /:splat/) would
 *   also rewrite /sitemap.xml and turn /about/ into /about//. So the 301s are enumerated,
 *   one line per page, and rule 5 is what stops that list from rotting as pages are added.
 *
 * USAGE
 *   node scripts/check-redirects.mjs
 * Exits 1 on any failed assertion. Reads sitemap.xml and _redirects; writes nothing.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://calc-hq.ca';
const RESERVED = ['/sitemap.xml', '/robots.txt', '/ads.txt'];

/** Canonical page paths from sitemap.xml, e.g. "/", "/payroll/take-home-pay/". */
function canonicalPaths() {
  const xml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  return new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(ORIGIN, '')));
}

/** Parsed rules: [{from, to, status, line}], comments and blanks dropped. */
function rules() {
  const text = readFileSync(join(ROOT, '_redirects'), 'utf8');
  return text
    .split('\n')
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter(({ raw }) => raw && !raw.startsWith('#'))
    .map(({ raw, line }) => {
      const [from, to, status] = raw.split(/\s+/);
      return { from, to, status, line };
    });
}

function main() {
  const pages = canonicalPaths();
  const table = rules();
  const sources = new Set(table.map((r) => r.from));
  const failures = [];

  for (const { from, to, status, line } of table) {
    if (pages.has(from)) {
      failures.push(`SHADOW   line ${line}: ${from} is a live page in sitemap.xml — this rule hides it`);
    }
    if (from === to) {
      failures.push(`SELF     line ${line}: ${from} redirects to itself`);
    }
    if (sources.has(to)) {
      failures.push(`CHAIN    line ${line}: ${from} -> ${to}, but ${to} is itself redirected`);
    }
    if (RESERVED.includes(from) || from.startsWith('/assets/')) {
      failures.push(`RESERVED line ${line}: ${from} must never be redirected`);
    }
    // Wildcard targets (:splat / :placeholder) cannot be resolved statically — skip rule 6.
    if (!pages.has(to) && !to.includes(':')) {
      const asFile = join(ROOT, to.replace(/^\//, ''));
      if (!existsSync(asFile)) {
        failures.push(`TARGET   line ${line}: ${from} -> ${to}, which is neither a canonical page nor a file`);
      }
    }
  }

  let covered = 0;
  for (const page of pages) {
    if (page === '/') continue; // root has no extensionless form
    const bare = page.replace(/\/$/, '');
    const rule = table.find((r) => r.from === bare);
    if (!rule) {
      failures.push(`COVERAGE ${bare} has no trailing-slash rule — it would answer 307, not 301`);
    } else if (rule.to !== page || rule.status !== '301') {
      failures.push(`COVERAGE ${bare} -> ${rule.to} ${rule.status}; expected ${page} 301`);
    } else {
      covered += 1;
    }
  }

  const out = [
    `${table.length} rules parsed, ${pages.size} canonical pages in sitemap.xml`,
    `${covered}/${pages.size - 1} pages have an extensionless 301 (root excluded — it has no bare form)`,
    '',
  ];
  if (failures.length) {
    out.push(`${failures.length} ISSUE(S):`, ...failures.map((f) => `  ${f}`));
  } else {
    out.push('PASS — no rule shadows a live page, loops, chains, or touches a reserved path;');
    out.push('       every canonical page has a permanent extensionless redirect.');
  }
  console.log(out.join('\n'));
  return failures.length ? 1 : 0;
}

process.exitCode = main();
