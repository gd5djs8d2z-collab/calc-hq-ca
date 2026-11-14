/**
 * check-seo.mjs — fails if any indexable page breaks the head-tag rules in CLAUDE.md ("SEO rules").
 *
 * Per indexable page (no robots noindex):
 *   TITLE       <title> present, unique across the site, at most 60 characters (entities decoded)
 *   DESC        meta description present, unique, 120–155 characters
 *   CANONICAL   rel=canonical on https://calc-hq.ca, equal to og:url
 *   OG / X      og:title, og:description, og:url, og:type, og:image, og:site_name,
 *               twitter:card = summary_large_image, twitter:title, twitter:description, twitter:image;
 *               twitter:title/description equal og:title/description; the og:image file exists
 *   HREFLANG    every hreflang target is a page that exists in this repo, is not the source of a
 *               _redirects rule (so it answers 200, not 301), and links back with its own hreflang
 *   INBOUND     linked from at least 2 other indexable pages (distinct pages, scripts ignored)
 *   SCHEMA      no Article JSON-LD anywhere (calculators and hubs are not articles);
 *               the homepage carries Organization JSON-LD
 * Every served file (HTML, JS, CSS, XML, TXT):
 *   WWW         no reference to www.calc-hq.ca — the apex https://calc-hq.ca is canonical
 *
 * --live additionally fetches every hreflang target from https://calc-hq.ca and fails on a non-200
 * (redirect: 'manual'), so a redirect added outside _redirects is caught too.
 *
 * USAGE   node scripts/check-seo.mjs [--live]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, htmlPages, isIndexable, urlPath } from './seo-pages.mjs';

const SITE = 'https://calc-hq.ca';

// Pages held out of a length rule on purpose. Each needs a reason and the date it was granted;
// remove the entry as soon as the reason lapses.
const EXEMPT = {
  '/payroll/take-home-pay/': {
    rules: ['TITLE-LENGTH', 'DESC-LENGTH'],
    reason: 'Ontario/Canada retitle (c025fde) is mid ranking recovery; title and meta frozen by owner, 2026-11-14.',
  },
};

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const one = (html, re) => { const m = html.match(re); return m ? decode(m[1]) : null; };
const meta = (html, key) => one(html, new RegExp(`<meta (?:property|name)="${key.replace(/:/g, ':')}" content="([^"]*)">`));

const failures = [];
const fail = (page, rule, msg) => {
  if (EXEMPT[page]?.rules.includes(rule)) return;
  failures.push(`${rule.padEnd(14)} ${page}  ${msg}`);
};

// _redirects sources answer 3xx, so a hreflang pointing at one is never a 200.
const redirectSources = new Set(readFileSync(join(ROOT, '_redirects'), 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/)[0]));

const files = htmlPages();
const byUrl = new Map(files.map((f) => [urlPath(f), f]));
const seenTitle = new Map(), seenDesc = new Map();
const hreflangTargets = new Set();
const inbound = new Map();                 // page -> Set of indexable pages linking to it
const indexable = new Set();
let pages = 0;

for (const file of files) {
  const html = readFileSync(join(ROOT, file), 'utf8');
  const page = urlPath(file);

  if (/"@type"\s*:\s*"(Article|NewsArticle|BlogPosting)"/.test(html)) fail(page, 'SCHEMA', 'Article JSON-LD on a calculator/hub page');
  if (!isIndexable(html)) continue;
  pages++;
  indexable.add(page);
  for (const [, h] of html.replace(/<script[\s\S]*?<\/script>/gi, '').matchAll(/<a [^>]*href="([^"#?]+)/g)) {
    const to = h.startsWith(SITE) ? h.slice(SITE.length) : h;
    if (to.startsWith('/') && to !== page) (inbound.get(to) || inbound.set(to, new Set()).get(to)).add(page);
  }

  const title = one(html, /<title>([\s\S]*?)<\/title>/);
  if (!title) fail(page, 'TITLE', 'missing <title>');
  else {
    if (title.length > 60) fail(page, 'TITLE-LENGTH', `${title.length} chars (max 60): ${title}`);
    if (seenTitle.has(title)) fail(page, 'TITLE-DUP', `same title as ${seenTitle.get(title)}`);
    seenTitle.set(title, page);
  }

  const desc = meta(html, 'description');
  if (!desc) fail(page, 'DESC', 'missing meta description');
  else {
    if (desc.length < 120 || desc.length > 155) fail(page, 'DESC-LENGTH', `${desc.length} chars (want 120–155)`);
    if (seenDesc.has(desc)) fail(page, 'DESC-DUP', `same description as ${seenDesc.get(desc)}`);
    seenDesc.set(desc, page);
  }

  const canonical = one(html, /<link rel="canonical" href="([^"]+)">/);
  if (canonical !== SITE + page) fail(page, 'CANONICAL', `canonical is ${canonical}, want ${SITE + page}`);

  const want = ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:site_name',
    'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
  const tags = Object.fromEntries(want.map((k) => [k, meta(html, k)]));
  for (const k of want) if (!tags[k]) fail(page, 'OG-X', `missing ${k}`);
  if (tags['og:url'] && tags['og:url'] !== canonical) fail(page, 'OG-X', `og:url ${tags['og:url']} differs from canonical`);
  if (tags['twitter:card'] && tags['twitter:card'] !== 'summary_large_image') fail(page, 'OG-X', `twitter:card is ${tags['twitter:card']}`);
  if (tags['twitter:title'] && tags['twitter:title'] !== tags['og:title']) fail(page, 'OG-X', 'twitter:title differs from og:title — run sync-social-tags.mjs');
  if (tags['twitter:description'] && tags['twitter:description'] !== tags['og:description']) fail(page, 'OG-X', 'twitter:description differs from og:description — run sync-social-tags.mjs');
  for (const k of ['og:image', 'twitter:image']) {
    const u = tags[k];
    if (u && (!u.startsWith(SITE + '/') || !existsSync(join(ROOT, u.slice(SITE.length))))) fail(page, 'OG-X', `${k} ${u} is not a file in this repo`);
  }

  for (const [, lang, href] of html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)) {
    hreflangTargets.add(href);
    const target = href.startsWith(SITE) ? href.slice(SITE.length) : null;
    if (!target || !byUrl.has(target)) { fail(page, 'HREFLANG', `${lang} -> ${href} is not a page in this repo`); continue; }
    if (redirectSources.has(target)) { fail(page, 'HREFLANG', `${lang} -> ${href} is a redirect source in _redirects`); continue; }
    if (target === page) continue;
    const back = readFileSync(join(ROOT, byUrl.get(target)), 'utf8');
    if (!back.includes(`hreflang="`) || !back.includes(`href="${SITE + page}"`)) fail(page, 'HREFLANG', `${href} does not hreflang back to ${SITE + page}`);
  }

  if (page === '/' && !/"@type"\s*:\s*"Organization"/.test(html)) fail(page, 'SCHEMA', 'homepage is missing Organization JSON-LD');
}

for (const page of indexable) {
  const n = inbound.get(page)?.size || 0;
  if (n < 2) fail(page, 'INBOUND', `linked from ${n} other page(s); want at least 2`);
}

// www references in anything served.
const SERVED = /\.(html|js|mjs|css|xml|txt|json|webmanifest)$/;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || ['node_modules', 'scripts', 'worker', 'data'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (SERVED.test(name) && /www\.calc-hq\.ca/i.test(readFileSync(p, 'utf8'))) fail('/' + relative(ROOT, p), 'WWW', 'references www.calc-hq.ca — use https://calc-hq.ca');
  }
})(ROOT);

if (process.argv.includes('--live')) {
  for (const href of hreflangTargets) {
    const res = await fetch(href, { redirect: 'manual' });
    if (res.status !== 200) fail(href.slice(SITE.length), 'HREFLANG-LIVE', `answers ${res.status}${res.headers.get('location') ? ' -> ' + res.headers.get('location') : ''}`);
  }
}

for (const [page, e] of Object.entries(EXEMPT)) console.log(`  exempt  ${page} (${e.rules.join(', ')}): ${e.reason}`);
if (failures.length) {
  console.log(failures.map((f) => '  ' + f).join('\n'));
  console.log(`\nFAIL — ${failures.length} problem(s) across ${pages} indexable page(s).`);
  process.exit(1);
}
console.log(`PASS — ${pages} indexable page(s): titles ≤60, descriptions 120–155 and unique, OG/X complete, ≥2 inbound links, hreflang resolves, no www links, schema rules hold.`);
