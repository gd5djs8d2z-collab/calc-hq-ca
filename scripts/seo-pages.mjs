/**
 * seo-pages.mjs — the list of served HTML pages, shared by sync-social-tags.mjs and check-seo.mjs.
 * Walks the repo (the deploy root — wrangler.jsonc sets assets.directory to "./") and skips
 * anything that is not a served page: dotfiles/worktrees, node_modules, scripts, worker.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SKIP = new Set(['node_modules', 'scripts', 'worker', 'data']);

/** Repo-relative paths of every served .html file, sorted. */
export function htmlPages(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) htmlPages(p, out);
    else if (name.endsWith('.html')) out.push(relative(ROOT, p));
  }
  return out.sort();
}

/** A page is indexable unless it carries a robots noindex. */
export const isIndexable = (html) => !/<meta name="robots" content="[^"]*noindex/i.test(html);

/** "payroll/pay-raise/index.html" -> "/payroll/pay-raise/" */
export const urlPath = (file) => '/' + file.replace(/index\.html$/, '');
