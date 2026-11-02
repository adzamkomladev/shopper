# Day 31 · Storefront + General Ledger

## Context

Notion row "31 · Storefront" (Phase 5, P0, 4 Nov) asks for: catalogue browse and search off the same product
tables; categories; SSR product pages with SEO metadata; images from R2; availability by branch with a store
selector; a `catalogue_public` read model honouring `online_visible` (the v1.5 hook). Tests: a product is hidden
when out of stock at the selected branch; the price shown equals the till price at the same moment. Done when the
store is browsable and indexable.

The owner also asked for a **general ledger** now. Today Shopper has customer credit, loyalty and stock ledgers,
but no books: only a derived daily "journal" report (`packages/core/src/reports/journal.ts`). Agreed scope:
**full GL** — chart of accounts, every money event posts a balanced entry in the same transaction, COGS at last
received cost, manual journals with reversal, a lock date, trial balance, P&L, balance sheet, account ledger with
drill-down to the source, CSV export. Agreed: **the shop root `/<code>` becomes the store**; the account stays at
`/<code>/account`.

Main is `587766d` (Release 0.1.1). Work on branch `day31-storefront-ledger`. Data is disposable: reset dev and
staging databases freely; no backfill of history into the ledger.

Figma (file `4MtEIWv8yBUBYgkrk4ubPk`): no storefront or ledger frames exist. Use **Web Flow** 312:8385
(header, Tabs, date range, Download, stat Tiles, detail panel) for the ledger screens; **Web Flow** 333:9119 /
302:7958 (search bar, tile grid, right rail) for the store grid; **Componets** 12:66 tokens; **New Login**
173:3087 field states; **Dashboard** 27:2031 table/settings frames; **Barcode Scanner** 45:852 for the empty and
scanning states. Pull exact values with `get_design_context` per frame while building.

## Part A · General ledger

### Data — migration `0037_ledger.sql` (forward-only, idempotent)

- `ledger_account`: org_id, id (UUIDv7), code (unique per org), name, type
  (`asset|liability|equity|income|expense`), `system_key` (unique per org, null for custom accounts), archived_at.
- `journal_entry`: org_id, id, `posted_on` (Accra date), occurred_at, source
  (`sale|refund|credit|loyalty|shift|stock|settlement|manual|reversal`), source_id, branch_id, memo, reverses_id
  (unique: an entry is reversed once), actor_id, created_at. **Unique (org_id, source, source_id)** = idempotent
  posting on replay.
- `journal_line`: org_id, id, entry_id, account_id, amount (signed money: debit +, credit −), branch_id, memo.
  Index (org_id, account_id, posted_on).
- Triggers: a deferred constraint trigger refuses any entry whose lines don't sum to 0 at commit or that has
  fewer than two lines; `journal_entry`/`journal_line` refuse UPDATE and DELETE (append-only, like audit).
- `org.ledger_locked_through date` (null = open).
- Drizzle schemas in `packages/db/pg/src/schemas/ledger/{accounts,journal}.ts`; `asset` gains purpose
  `product_image` (see B). Every table has org_id and composite FKs as in `schemas/customers/base.ts`.

### Chart of accounts (seeded in `packages/core/src/provisioning.ts`; migration seeds existing orgs)

| Type      | System accounts (code · key)                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset     | 1000 Cash in drawers · 1010 Cash in safe · 1020 Bank · 1030 MoMo clearing · 1040 Card clearing · 1100 Customer accounts (AR) · 1200 Inventory                                    |
| Liability | 2000 Goods received, not billed · 2100 VAT payable · 2110 NHIL payable · 2120 GETFund payable · 2130 COVID-19 levy payable · 2300 Loyalty points                                   |
| Equity    | 3000 Owner's equity · 3100 Retained earnings (balance sheet adds current-period earnings)                                                                                          |
| Income    | 4000 Sales · 4010 Sales returns (contra) · 4100 Account interest · 4200 Cash rounding · 4300 Cash over/short                                                                       |
| Expense   | 5000 Cost of goods sold · 5100 Stock shrinkage · 5200 Payment fees · 5300 Loyalty rewards                                                                                         |

Owners may add custom accounts (code, name, type) and archive custom ones; system accounts can be renamed, not
archived or retyped.

### Posting (one helper, called inside each existing command's transaction)

`packages/core/src/ledger/post.ts` — `postEntry(tx, ctx, { source, sourceId, occurredAt, branchId, memo, lines })`:
drops zero lines, resolves system keys to ids, checks balance (throws), dates the entry on its Accra day or the
first open day after the lock date (keeping occurred_at), inserts with `onConflictDoNothing` on the source key.
Rules are small pure builders in `packages/core/src/ledger/rules/*.ts`, all arithmetic via `@shopper/money`.

| Source (call site)                                                                 | Entry                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sale (`sales/accept.ts`)                                                           | Dr cash (net of change) / MoMo / card clearing / AR (credit tender) / loyalty liability (points tender); Cr Sales ex-tax and each levy from the snapshotted line tax; rounding ±; Dr COGS / Cr Inventory at last received cost (`stock/valuation.ts` `lastCosts`) |
| Points earned (in the same sale)                                                   | Dr Loyalty rewards / Cr Loyalty points at `org.loyaltyPointValue`                                                                                                                           |
| Refund (`refunds/accept.ts`)                                                       | Dr Sales returns ex-tax and each levy; Cr the payout tenders; restocked lines Dr Inventory / Cr COGS; points reversed                                                                       |
| Credit (`customers/credit/{payments,interest,refunds}.ts`, credit notes)           | Payment Dr tender / Cr AR; interest Dr AR / Cr Account interest; credit note Dr Sales returns / Cr AR; transfers post nothing (same control account)                                       |
| Loyalty expiry (`customers/loyalty/expiry.ts`)                                     | Dr Loyalty points / Cr Loyalty rewards                                                                                                                                                      |
| Shift close (`shifts/accept.ts`)                                                   | Drops Dr Cash in safe / Cr Cash in drawers; each tender's variance against Cash over/short                                                                                                  |
| Stock (`stock/accept.ts`)                                                          | Costed receipt Dr Inventory / Cr Goods received, not billed; adjustments and counts at last cost against Stock shrinkage (found stock reverses it); uncosted lines post nothing and are flagged in the ledger view |
| Settlement (`payments/settlements/record.ts`)                                      | Dr Bank (net), Dr Payment fees; Cr MoMo clearing (gross)                                                                                                                                    |
| Manual / reversal (new commands)                                                   | User lines, balanced, ≥2, dated on or after the lock date; a reversal mirrors the original once                                                                                             |

The derived `reports/journal.ts` report and its screen are **retired** (one source of truth): the Reports
"Journal" tab links to the Ledger journal; its export test moves to the GL.

### API (`packages/api/src/routes/ledger/*.ts`) and permissions

New permissions `ledger.read`, `ledger.write`, `ledger.lock` (data in `schemas/permissions` and
`roles/defaults.ts`: accountant gets all three; admin via its default filter). Routes:
`GET /ledger/accounts` (with balances), `POST/PATCH /ledger/accounts`, `GET /ledger/accounts/:id/lines`
(range, running balance, source link, CSV), `GET/POST /ledger/journal`, `POST /ledger/journal/:id/reverse`,
`GET /ledger/trial-balance?asOf`, `GET /ledger/profit-loss?from&to`, `GET /ledger/balance-sheet?asOf`
(each with `.csv`), `PUT /ledger/lock`. All in the tenant sweep with bodies in `tests/support/security/bodies.ts`.
Queries in `packages/core/src/ledger/{queries,reports}.ts`, schemas in `packages/core/src/schemas/ledger/`.

### Back office (`@shopper/backoffice`)

`routes/ledger.tsx`, `screens/ledger/{accounts,account,journal,reports}/screen.tsx`,
`components/ledger/…`, `queries/ledger/…`, nav item "Ledger" for `ledger.read`. Layout from Figma 312:8385:
title, Tabs (Accounts · Journal · Trial balance · Profit & loss · Balance sheet), date-range picker and Download
on the right, stat Tiles (Revenue, Gross profit, Net profit, Cash position) above the tables. Manual journal in a
Sheet with a line editor that shows the running difference and only enables Post when balanced (Ctrl+Enter
posts; every action has a shortcut). Lock date under Settings → Ledger. Every state designed: loading skeleton
(audited), empty ("No entries yet — sales post here as they sync"), error, locked-period warning, forbidden.

## Part B · Storefront (Day 31)

### Read model and API

- SQL view `catalogue_public` (migration 0037): online_visible, not archived products with sku, name,
  category, base unit, image asset id. `packages/core/src/storefront/catalogue.ts` is the **only** reader the
  store uses (`listStoreProducts`, `readStoreProduct`, `listStoreCategories`, `listStoreBranches`); price is
  `priceAt(branch, now)` (`catalogue/prices/commands.ts`, the till's rule: branch override beats org price), and
  stock is `onHandOf` (`stock/onhand.ts`). A product with no price or on hand ≤ 0 at the branch is not listed and
  its page says "Not available at <branch>" (200, `noindex`), so v1.5 can point the module at relay data.
- Public routes in `packages/api/src/routes/shop/store.ts`: `GET /shop/:code/store` (name, branches),
  `/shop/:code/categories`, `/shop/:code/products?branch&category&q&page`, `/shop/:code/products/:id?branch`,
  `/shop/:code/images/:assetId` (302 to a 300 s `blobs.createDownload` grant, `Cache-Control: max-age=240`;
  only `product_image` assets linked to a visible product of that shop). Added to the sweep's `PUBLIC`
  list and the public rate policy.

### Product images (back office → R2/RustFS)

`packages/assets/src/products.ts`: `issueProductImageUpload` (jpeg/png/webp ≤ 2 MB, key
`receipts/products/<id>` so both stores keep it durable) and `attachProductImage` (verifies bounded bytes,
size and SHA-256 immediately before linking `product.image_asset_id`, audited). Product editor gains an image
field (direct PUT with the grant, preview, replace, remove).

### `apps/shop`

- Routes: `/$shop/` store home (search, category chips, product grid, pagination), `/$shop/categories/$id`,
  `/$shop/products/$id`, `/$shop/sitemap.xml` and `/robots.txt` server routes; `?branch=` search param
  (Valibot-validated, default first branch) with a branch selector sheet in the header; header links to the
  account. Data loads on the server (public data); personal data still loads in the browser.
- SEO: per-page title/description, canonical URL, Open Graph image, `Product` JSON-LD with GHS price and
  `InStock`, sitemap of visible products and categories.
- Look: the Day 30 shop theme (`[data-surface="shop"]`), tiles adapted from Figma "Tile"/"Sale action", bold
  type, prices through `Money`/`formatGHS`, images lazy with fixed aspect boxes, staggered entrance and hover
  lift, all off under reduced motion. States: loading skeletons, empty catalogue, no search results, product
  unavailable at branch, unknown shop/product 404, error retry. Keyboard: `/` focuses search, arrows move in
  the grid, Enter opens. No cart yet (Day 32).

## Slices (tests first, one commit each)

| #   | Slice                                                                                                | Tests written first (all integration on the Postgres 18 fixture + golden sale fixtures, e2e in Playwright)                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Branch, `docs/plans/day31/plan.md`, Notion row → In progress                                        | —                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1   | Migration, ledger schemas, chart seeding, `postEntry`, DB triggers                                    | `tests/integration/ledger/journal.test.ts`: raw unbalanced or one-line insert fails at commit; UPDATE/DELETE refused; new org has the chart; replayed source posts once                                                                                                                                                                                                                                  |
| 2   | Sale + loyalty earn posting                                                                          | `ledger/sale.test.ts`: golden sale → one balanced entry; levies equal the snapshotted tax; cash net of change; rounding; COGS at last cost; no cost → no COGS line + flag; replay posts nothing; audit chain verifies                                                                                                                                                                                       |
| 3   | Refund, credit, loyalty expiry posting                                                               | `ledger/refund.test.ts`, `ledger/credit.test.ts` (**AR control balance equals the sum of customers' credit folds** after charge, payment, interest, note, merge), `ledger/loyalty.test.ts` (liability equals points fold × value)                                                                                                                                                                         |
| 4   | Shift, stock, settlement posting; lock date                                                          | `ledger/shift.test.ts` (drops, over/short), `ledger/stock.test.ts` (costed receipt, damage at last cost, found), `ledger/settlement.test.ts`, `ledger/lock.test.ts` (late offline sale in a locked period lands on the first open day; manual entry before lock 409)                                                                                                                                       |
| 5   | Manual journals, reversal, accounts CRUD, reports, API, permissions; retire derived journal          | `ledger/manual.test.ts` (unbalanced 422, reverse once), `ledger/reports.test.ts` (**trial balance balances; P&L net = income − expense; assets = liabilities + equity + current earnings; a day's GL sales and levies equal the tax report for that day**), `ledger/permissions.test.ts` (cashier 403), tenant sweep + bodies                                                                                   |
| 6   | Ledger back office screens                                                                           | `tests/e2e/portal/ledger/{journal,reports,accounts}.spec.ts`: post and reverse a manual journal by keyboard, balanced-only Post, TB/P&L/BS render and download CSV, drill from account line to source sale, locked-period warning                                                                                                                                                                        |
| 7   | `catalogue_public`, storefront module and public API                                                 | **Day's key tests** `tests/integration/shop/storefront.test.ts`: product hidden when out of stock at the selected branch (shown at the branch that has it); **price equals the till price at the same moment** (a till sale at that instant, branch override, future price not shown early); hidden/archived never listed; search, category, paging; unknown code 404; tenant isolation |
| 8   | Product images                                                                                       | `tests/integration/catalogue/images.test.ts`: grant, digest mismatch refused, only linked images of visible products redirect, other shop's asset 404                                                                                                                                                                                                                                                      |
| 9   | Store UI in `apps/shop` + SEO + sitemap; product image field in back office                          | `tests/e2e/shop/store.spec.ts` (browse, category, search, branch switch hides the OOS product, product page meta + JSON-LD, sitemap lists visible products only), `tests/e2e/shop/store-states.spec.ts`, `tests/e2e/portal/catalogue/image.spec.ts`                                                                                                                                                        |
| 10  | `/ui-verify` (desktop, laptop, tablet, mobile, till) light + dark, keyboard, console, overflow; `/skeleton-audit` for store and ledger skeletons; screenshots in `docs/plans/day31/screenshots/` | screenshots                                                                                                                                                                                                                                                                                                                                                                                                |
| 11  | Docs: AGENTS.md rule "every money mutation posts a balanced journal entry via `postEntry` in the same transaction", `docs/engineering/architecture.md` (ledger), `security.md` (public store routes, image grants), `frontend.md` (store area), `docs/plans/day31/verification.md` | —                                                                                                                                                                                                                                                                                                                                                                                                          |

## How I'll work (as asked)

- No subagents; I do everything in this session at medium effort. Per slice: write the meaningful failing tests,
  implement, run, fix.
- Skills inline: `/tdd-slice` per slice, `/ui-screen` + `/ui-verify` + `/playwright-cli` for slices 6 and 9–10,
  `/skeleton-audit`, `/cloud-box-parity` (store routes and image grants on Workers and the box),
  `/pre-merge-review` (runs `codex review` on `gpt-6.1-sol` directly from Bash; if Codex is still out of quota
  until 4 Nov, `/code-review` and I say so). `vp run guard` hook kept clean; files under 250/300 lines.
- MCPs: Figma (design context per frame), shadcn (component lookups), Notion (status + remarks), Playwright MCP
  only as fallback.
- Commit after each slice (no AI attribution). Push only when all slices are done; open the PR, bind it and
  enable Auto-fix with the ccd_pr tools, fix and push on any CI failure until green, then merge and
  fast-forward local `main`.
- Notion: Day 31 row → Done with ticked tasks, a Progress section (PR link, test counts, what shipped incl. the
  ledger) and Remarks (deferred items, review outcome, CI catches).

## Verification

- `vp test --run` (new ledger, storefront, images suites + tenant sweep), `vp check`, `vp run guard`,
  `vp run build` (portal, shop, box).
- Playwright `standard`, `public` and `shop` projects green locally and in CI.
- Break-it checks: post sales without levies (sale + reports tests fail); drop the branch filter on on-hand
  (out-of-stock test fails); price from the org row ignoring the branch override (till-price test fails);
  remove the balance trigger (journal test fails); allow a second reversal (manual test fails).
- Manual: on the e2e host, sell at the till, open the store at mobile width, switch branch, see the product
  vanish where it's out of stock; open the Ledger and see the sale in the trial balance.

## Critical files

- New: `packages/db/pg/migrations/0037_ledger.sql`, `packages/db/pg/src/schemas/ledger/*`,
  `packages/core/src/ledger/{post,queries,reports,commands}.ts` + `rules/*`, `packages/core/src/schemas/ledger/*`,
  `packages/core/src/storefront/catalogue.ts`, `packages/assets/src/products.ts`,
  `packages/api/src/routes/{ledger/*,shop/store.ts}`, `packages/backoffice/src/{routes/ledger.tsx,screens/ledger/*,components/ledger/*,queries/ledger/*}`,
  `apps/shop/src/routes/$shop/{index,categories.$id,products.$id}.tsx`, sitemap/robots routes,
  `apps/shop/src/components/store/*`, tests listed above, `tests/support/ledger/*`.
- Changed: `sales/accept.ts`, `refunds/accept.ts`, `shifts/accept.ts`, `stock/accept.ts`,
  `customers/credit/{payments,interest,refunds}.ts`, credit notes, `customers/loyalty/{points,expiry}.ts`,
  `payments/settlements/record.ts`, `provisioning.ts`, `packages/auth/src/{schemas/permissions,roles/defaults}.ts`,
  `packages/db/pg/src/schemas/{assets,catalogue,orgs}.ts`, `assets/schemas/policy.ts`, `api/src/app.ts`,
  `tests/integration/security/tenant/sweep.test.ts`, `tests/support/security/bodies.ts`, `playwright.config.ts`,
  retired `reports/journal.ts` + its screen.
- Reused: `priceAt`, `onHandOf`/`onHand`, `lastCosts`, `defineCommand`, `redact`, `issueKybUpload`/`verifyKybDocument`
  pattern, `Blobs.createDownload`, `readShop`, Day 30 shop theme and `Missing`, `formatGHS`/`Money`, report
  `reportRange`/`inSnapshot` helpers.
