---
name: skeleton-audit
description: Audit and fix Shopper loading skeletons so nothing moves when data arrives - measure the loaded UI in every state with playwright-cli, then size the Skeleton blocks to the real boxes and prove zero layout shift. Use when building or changing a skeleton, a Suspense fallback or a route pendingComponent, or when the user reports layout jank.
---

# Skeleton audit

A skeleton is a promise about where the content will land. Guessed sizes break it: the page jumps
when data arrives. Measure the real UI first, then draw the skeleton from the numbers. Load the
`playwright-cli` skill for command syntax and run this in the real app (see `ui-verify` step 2).

1. **List the skeletons in scope.** `rg -l "<Skeleton" apps packages --glob '*.tsx'`, plus the
   `pendingComponent` and `<Suspense fallback>` they feed. Note which loaded component each one
   stands in for and which states that component has (rows present, empty, one row, long names,
   no-permission, offline).
2. **Measure the loaded UI** at every target size (desktop 1920×1080, laptop 1440×900, tablet
   768×1024, mobile 390×844, till 1366×768) and in every state from step 1. Record the boxes of the
   container and of each block the skeleton imitates (header, toolbar, rows, totals, buttons):

   ```bash
   playwright-cli resize 1440 900
   playwright-cli --raw eval "JSON.stringify([...document.querySelectorAll('main, main h1, main [role=row], main button, main table')].map(e => { const r = e.getBoundingClientRect(); return { el: e.tagName + (e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : ''), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }))"
   ```

   Pick selectors for the screen at hand; roles and landmarks first, as in the e2e tests.

3. **Measure the skeleton the same way.** Hold the loading state by delaying the API, then run the
   same eval while the skeleton shows (`[data-slot=skeleton]` finds its blocks):

   ```bash
   playwright-cli run-code "async page => { await page.route('**/api/**', async r => { await new Promise(f => setTimeout(f, 8000)); await r.continue() }); await page.reload() }"
   ```

   This delay is a verification aid only. E2E tests never fake API data (testing.md).

4. **Size the skeleton to the measurements.** Reuse the loaded component's own layout (the same
   grid, `DataTable` columns, row height, paddings and gaps) and put `Skeleton` blocks in the
   cells. Use the tokens that produce the measured sizes (`h-9`, `gap-4`), never px or arbitrary
   values. Match the row count the first page usually shows, and reserve space for fixed chrome
   (toolbar, totals, pager) even if its data comes later. When states differ in size (empty vs
   rows), the skeleton matches the most common one and the others keep the container size.
5. **Prove it does not move.** With the API still delayed, record layout shift across the swap:

   ```bash
   playwright-cli run-code "async page => { await page.evaluate(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }); await page.unroute('**/api/**'); await page.waitForLoadState('networkidle'); return page.evaluate(() => window.__cls) }"
   ```

   The target is `0`; anything above `0.01` is a failure. Also compare the step 2 and step 3 boxes:
   container and block edges within 2 px at every size.

6. **Screenshot both states** per size under `.playwright-cli/` and look at them side by side.
   Then `playwright-cli unroute` and `playwright-cli close`.
7. **Report** a table per skeleton: size, state, loaded vs skeleton box, shift score, and what was
   changed or is still off.

Skeleton slop: a generic stack of grey bars reused on every screen, a spinner inside a skeleton,
widths that differ from the loaded columns, a skeleton shorter than the content so the footer
jumps, and skeleton rows taller or shorter than real rows.
