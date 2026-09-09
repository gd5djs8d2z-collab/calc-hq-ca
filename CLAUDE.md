# CLAUDE.md — calc-hq.ca

Canadian payroll, benefit and tax calculators for the 2026 tax year.

Every figure the calculators consume comes from `data/tax-constants-2026.js`,
each one stamped with `source_url` + `last_verified` (see MAINTENANCE.md).
Page prose restates figures as literals — there is no runtime fill — so the
pack and the copy can drift apart. That is what the gates in `scripts/` exist
to catch.

Global rules (word ban, voice, surgical patch protocol, incomplete specs) load
from `~/.claude/CLAUDE.md` and are deliberately not repeated here.

## "Deepen [page]"

When I say **deepen** a page, it means all of the following without my having
to restate any of it:

1. **800–1000 words** of body content — a target, not a hard cap. Don't cut
   substance to hit it. Report the actual count and let me decide whether a
   long page gets trimmed.
2. **Content only — no calculator changes.** The `.calc-card` markup and the
   page's `<script type="module">` stay untouched.
3. **Verify rates on Canada.ca.** Not against the pack — go to the CRA or
   Service Canada page that carries the number, confirm it there, and say
   which page it came from. The pack being stamped is not verification; it is
   the thing being checked.
4. **Read the sibling pages first, then diverge.** Different opening move,
   different section headings, different example framing. If a sentence would
   work on a sibling page with the noun swapped, rewrite it.
5. **Run the 6-gram overlap check** against the siblings before calling it
   done. Anything shared beyond site chrome is a defect — fix it, or tell me
   why it stays.
6. **Show me the diff before committing.** Never commit or push until I say
   so, in chat, in that message.

### The 6-gram check

```bash
python3 - <<'PY'
import re, html
def words(p):
    s = re.sub(r'<script[\s\S]*?</script>', '', open(p).read())
    return html.unescape(re.sub(r'<[^>]+>', ' ', s)).split()
def grams(w, n=6):
    return {' '.join(w[i:i+n]).lower() for i in range(len(w) - n + 1)}
a = grams(words('tax-on-extra-income/bonus/index.html'))
b = grams(words('tax-on-extra-income/commission/index.html'))
for c in sorted(a & b): print(' ', c)
PY
```

Header nav, footer, the province dropdown and the disclaimer will dominate the
output — that is expected. Read past it and look for shared *body* prose.

## Before finishing any content change

Run the gates:

```bash
for s in check-schema check-constants check-redirects test-schema test-invariants; do printf "%-18s " "$s"; node scripts/$s.mjs >/dev/null 2>&1 && echo PASS || echo FAIL; done
```

Then render the page and confirm it — grep does not prove wiring. The `static`
launch config is blocked by the sandbox; use the `wrangler` one
(`preview_start` with name `wrangler`, port 8788) and check:

- the live calculator output matches any figures quoted in the prose
- new tables actually lay out (`getBoundingClientRect`, not just presence)
- internal links return 200 from the running server, not merely exist on disk
- no console errors

Derive worked-example numbers by running the engine, never by hand — that is
what keeps prose and calculator from drifting.

## FAQ JSON-LD

Every page restates its visible FAQ inside an `application/ld+json` FAQPage
block. New entries must match the visible text **verbatim**. Several older
entries are paraphrases of their visible answers; that predates this file, and
`check-schema` does not test for it — it only catches retired pack figures and
invalid JSON.
