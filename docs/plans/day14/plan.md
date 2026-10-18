# Day 14: refunds and manager overrides

Approved 18 October 2026. Source: Notion Day 14 (https://app.notion.com/p/3eba2c999ce98155a227d1a2ab896ce0).

## Context

The Notion Day 14 row is "Catch-up + refunds & overrides" (Sun 18 Oct, Ubuntu, Till + Audit).
- **Catch-up:** Days 1–13 are all marked Done. The only open items are the Day 13 device steps, which need Windows and the real hardware, so they stay deferred. There is no code catch-up.
- **The day's work:**
  - refunds against an original sale, full or partial, with the items going back into stock;
  - tax reversed from the original sale's tax snapshot;
  - a manager PIN to approve refunds, price overrides and voids after tender, with the approver recorded in the audit row.
- **Tests Notion requires:**
  - a partial refund reverses exactly the refunded lines' tax;
  - an override without a manager PIN is refused, and with a PIN the audit shows both actor and approver.
- **Weekly review:** update statuses and re-plan days 15–21.

**Your decisions:**
1. **Which sales:** this till's sales refund offline. Sales from other registers are found and refunded through the server, online only.
2. **Offline approvals:** each manager's PIN hash and approval permissions sync down to the till. 5 wrong PINs lock the manager for 15 minutes.
3. **How money goes back:** cash, which opens the drawer. Card and MoMo refunds are recorded manually with a reference. No Paystack refund call.
4. **Policy:** a return window setting (default 30 days), plus a product "final sale" flag. An approver can override the window. `requirePinForReturns` is enforced from now on.
5. **Data:** all data is disposable, so schema resets are fine. Codex is unavailable, so the `reviewer` agent reviews. One commit per slice, and a single push at the end.

**Defaults I took (change them at approval if you want):**
- **Branch:** work on branch `day14-refunds-overrides`, cut from `origin/main` in this checkout. Your modified `.claude/settings.json` is never staged.
- **Approval PIN:** when approval is mandatory, a signed-in manager still types their own PIN. The approver may be the actor.
- **Final-sale lines:** never refundable, even with approval.
- **Where policy is enforced:** the till enforces the window, final sale and PIN-for-returns, because those settings live only on the till. The server enforces quantity, tax arithmetic, session authority and approver grants.
- **Refund receipt numbers:** a refund receipt has no number of its own. It prints "REFUND · Refund of BR…" until the GRA credit-note day.
- **Wrap-up:** push, open the PR, and merge once CI is green, as on Days 12 and 13. Then update the Notion Day 14 row: tick the tasks, set Status to Done, and add Remarks.
- **Plan copy:** this plan is saved as `docs/plans/day14/plan.md` in the first commit. `progress.md` and `verification.md` are written as the work goes.

## Design

### Data model: refunds are their own records, not negative sales

This keeps every sale rule and every sale report unchanged.

**Postgres:**
- `packages/db/pg/src/schemas/refunds.ts` adds two tables:
  - `refund`: org, device, store, branch, cashier, session, `approver_id`, `original_sale_id`, reason, `tender_kind` and `tender_reference` (required unless cash), gross, `cash_rounding`, total, receipt jsonb, `content_hash`, `event_version`;
  - `refund_line`: `original_line_id`, `product_id`, `quantity_thousandths > 0`, and the tax-share payload.
- `stock_movement` gets `refund_id`/`refund_line_id`, with a check that a `return` movement is positive and linked to a refund.
- `product.final_sale` is added.
- Migrations are generated with drizzle-kit: `0021_final_sale.sql` and `0022_refunds.sql`.

**Till SQLite** (`packages/db/sqlite/src/till.ts`). New steps are appended; shipped steps are never edited.
- Step 5: `till_approver`.
- Step 6: the draft-line override columns.
- Step 7: the `refund` table, and a rebuild of `stock_movement` so it allows `return` and nullable sale ids.
- The Drizzle mirrors go in `schemas/till/{refunds,approvers,stock,drafts}.ts`.

### Refund tax arithmetic: `packages/tax/src/refund.ts`, `refundShare(original, before, after)`

- **The rule:** for each component (base, VAT, NHIL, GETFund, COVID, gross, discount), `share = cum(after) − cum(before)`, where `cum(x) = x === Q ? c : mulRatio(c, x, Q)`.
- **Why:** shares are never negative, and any number of partial refunds sum exactly to the original line.
- **Rounding adjustment:** gross minus the sum of the tax components.
- **Rule and rates:** the rule, date and rates are copied from the original snapshot. Today's `tax_rule` is never read.
- **Cash payout:** a cash refund pays the difference of `roundCash` on the cumulative gross, so a full refund returns exactly the rounded total.

### Sync

- **Refund event:** `refundEvent {v:1, type:"refund.recorded"}` in `packages/core/src/schemas/till/refund.ts`.
- **Upload lane:** a refund uploads only after the till's sale backlog drains, like stock documents.
  - `packages/sync/src/uploads/documents.ts` holds the shared upload loop. The stock and refund uploads are small configurations of it.
- **Server** (`packages/core/src/refunds/accept.ts`): `refund.accept` is a `defineCommand` with `replay`.
  - It checks that the session holds `refund.request`.
  - If there is an approver, the approver must have `refund.approve` in `role_permission`.
  - It locks the original sale with `FOR UPDATE` and rejects anything over the quantity sold (`REFUND_EXCEEDS_SALE` / `REFUND_CONFLICT`).
  - It recomputes every share from the stored `sale_line.payload` and requires an exact match.
  - It writes refund lines, positive `return` stock movements and an audit row with `approverId`.
- **Lookup** (`refunds/lookup.ts`): `GET /sync/sales/lookup?receipt=` finds sales from other registers, scoped to the store. It returns the quantities already refunded and the final-sale flags.
- **Routes** (in `@shopper/api`, so both hosts serve them):
  - `POST /sync/refunds` (`sync/refunds.ts`)
  - `GET /sync/approvers` (`sync/approvers.ts`)
- **Authority check:** the session check and grant query move from `packages/core/src/sales/validate.ts:24-111` into `sales/authority.ts` (`sessionAuthority`, `hasGrant`). Sales and refunds both use it.

### Approvals: one mechanism for all three actions

- **Server side** (`@shopper/auth`):
  - new permission `sale.price_override`, added to `tillPermissions`;
  - `verifyPin`, which wraps Better Auth's `verifyPassword` and is also used by the existing `pinIdentity`;
  - `listApprovers`: org members with a PIN and an approval grant.
- **Till side** (`packages/core/src/till/approvals.ts`):
  - `approve` reads `till_approver`, checks the permission, a list no older than 7 days, the lockout and the PIN. Failures are audited as `approval.failed`/`approval.reset`. The Day 13 lockout constants move here.
  - `authorize(session, permission, approverId, mandatory)` decides when an approval is needed.
  - `till.approvers.refresh` runs on start, after pulls and on Sync now.
- **Host** (`packages/adapters/box/src/till/host/approvals.ts`): checks the PIN and then passes only the verified `approverId` to the core command. The UI can never send a bare approver id.

| Action | Approver needs | Approval mandatory when |
| --- | --- | --- |
| Refund (actor needs `refund.request`) | `refund.approve` | `requirePinForReturns`, or the sale is outside the window |
| Price override | `sale.price_override` | unless the actor holds it |
| Void after tender | `sale.void` | the draft has an applied cash or card tender (a confirmed MoMo tender still blocks the void) |

### Price override

- **Till command:** `till.draft.price` (`core/till/drafts/price.ts`) refuses price-labelled lines. `quote.ts` uses `override_price`.
- **Sale line:** carries `override {listPrice, reason, approverId}`. This makes it sale event v4, sync protocol 4 (`tooling/build/info.ts`) and feed v3.
- **No upcaster,** per your reset decision: drain or reset tills before upgrading.
- **Server check:** `validate.ts` accepts an overridden unit price only if `listPrice` equals the price row and the actor or approver holds the grant. Without an override, the price must still match the price row exactly.

### Till refunds (`packages/core/src/till/refunds/`)

- **`eligibility.ts`:** checks the window and final-sale lines, and works out what quantity is still refundable. Its `buildRefund` uses `refundShare`.
- **`record.ts`:** the `refund.record` command. It re-checks quantities inside the SQLite transaction and writes the refund and `return` stock movements.
- **`queries.ts` and `uploads.ts`:** queries for refund data, and the marks the upload lane sets.
- **Purchases** (`core/till/purchases.ts`): adds Returns rows, counts per status, search across all days, and refunds plus eligibility on the detail.
- **Settings and report:** `returnWindowDays` is added to the register settings, and the register report's `returns` is filled. That lights up the back-office "Total returns" tile.
- **Host** (`host/refunds.ts`):
  - **Sales on this till:** recorded locally, then printed and the drawer kicked, then uploaded.
  - **Sales from other registers:** a fresh lookup, then a `POST` and wait for the server. If accepted, it is recorded with `accepted_at` set and then printed and kicked. If rejected, nothing is recorded and the drawer stays shut.

### Receipts

- **Document v2:** the receipt document gains `kind: sale|refund` and `refundOf`.
- **Builder:** `buildRefundReceipt` goes in `core/receipts/build.ts`.
- **Rendering** in `@shopper/hardware`:
  - the view and ESC/POS show a REFUND heading and "Refunded (method/ref)";
  - the view stays Satori-safe.
- **Host:** `host/receipts.ts` generalises `afterSale` into `afterDocument`, so refunds print, kick the drawer and reprint without a PDF.

### Final-sale flag

It goes in four places:
- the catalogue input and view schemas;
- the feed projection and snapshot;
- the till's reference decoder;
- a "Final sale (cannot be returned)" switch in the back-office product form (`components/catalogue/detail/details/form.tsx`).

## UI

The till screens are built with `@shopper/ui`. There are no Figma frames for the return picker, the PIN fields or the price override, so those are composed from existing components. Figma stays read-only.

- **Approval fields** (`components/approval/fields.tsx`): approver select and masked PIN, embedded in the calling dialog or screen so no dialog opens on top of another. States: none synced, list out of date, wrong PIN with tries left, locked, forbidden.
- **Void** (`void.tsx`, `hooks/sale/controls.ts`): F11 always opens the dialog. Approval fields appear when tenders exist or the user lacks `sale.void`.
- **Price override** (`components/sale/dialogs/price.tsx`): opened with Alt+O on the selected line. Price-labelled lines are disabled, with the reason shown. The cart shows the list price struck through.
- **Previous purchases** (Figma 55:2263):
  - tabs All, Completed, Returns, Voided and Pending, each with a count;
  - a Returned badge, and returns shown as negative totals;
  - search covers all days;
  - a "Find on server" row appears when nothing local matches, with an offline state.
- **Purchase detail** (Figma 55:3230):
  - header: "Return eligible until …", Reprint (Alt+R) and a red Start return (Alt+E);
  - a Returns column (Eligible / Final sale / Returned n) and a footer summary;
  - a Refunds row in the totals;
  - a new `detail/eligibility.tsx` card.
- **Return screen** (`screens/purchases/return/screen.tsx` and `components/purchases/return/{lines,tender,summary}.tsx`):
  - a quantity stepper on each line;
  - a reason field;
  - the refund method: Alt+1 cash, Alt+2 card, Alt+3 MoMo, with a reference field for card and MoMo;
  - a live tax and total summary;
  - approval fields when the policy needs them;
  - "Refund GH₵ x" on Mod+Enter, and Esc to go back.
  - States: loading, nothing to return, offline for another register's sale, no permission, server rejection, success.
- **Settings** (`components/settings/cashier.tsx`): a "Return window (days)" field.
- **Verification:** `/ui-verify` with `playwright-cli` at desktop, laptop, tablet, mobile and till sizes, checking every state, the keyboard path, axe, the console and overflow.

**Left out:**
- refund receipt numbers and GRA credit notes;
- refund PDFs;
- Paystack refunds;
- a back-office refunds list;
- refunds in the Z-report (Day 15);
- Figma's date picker, Export CSV and Customer column;
- branch-scoped approvers, because members have no branch;
- clearing a price override (remove the line instead).

## Tests, written first

**Notion-required:**
- `tests/integration/sales/refunds/tax.test.ts`:
  - a partial refund reverses exactly the refunded lines' tax;
  - two partial refunds sum to the original line exactly;
  - a refund uses the sale's snapshot after a new tax rule takes effect.
- `tests/integration/till/basket/drafts/override.test.ts`: an override without a PIN is refused with `APPROVAL_REQUIRED`. With a PIN, `till_audit` shows both actor and approver, and the chain verifies.

**Approvals:**
- `sync/approvers/refresh`: managers' PIN hashes and grants reach the till and cashiers' do not; a PIN change replaces the till's copy.
- `till/approvals/pin`: 5 wrong PINs lock the manager; a missing permission is refused; a list older than 7 days stops offline approval.

**Price override:**
- `sales/tenders/override`: an override is accepted when the approver holds the grant; it is rejected without the grant; a changed price with no override is still rejected.

**Void after tender:**
- `till/basket/drafts/void`: a tendered draft needs a PIN; a cashier without `sale.void` can void with a PIN; a confirmed MoMo draft still cannot be voided.

**Server refunds:**
- `sales/refunds/quantity`: refunding more than was sold is rejected; when two registers refund at once, only one is accepted.
- `sales/refunds/accept`: the refund writes its rows, a return stock movement and an audit row with the approver; a replay writes no second audit row; a session without `refund.request` is rejected.
- `sync/refunds/lookup`: another register's sale is found; a sale from another store is not.

**Till refunds:**
- `till/refunds/record`: a partial local refund records, kicks the drawer for cash, and uploads after the sale.
- `till/refunds/policy`: the window, `requirePinForReturns` and final-sale rules hold.
- `till/refunds/cross`: an online refund of another register's sale waits for the server; offline it shows the connect message; a server rejection records nothing.

**Receipts, reports and storage:**
- `receipts/refund`: the refund heading appears in HTML, ESC/POS and PNG.
- `till/reports/returns`: the report counts refunds.
- `till/storage/migrations`: the new steps keep existing sale movements.

**Workerd:** the new `/sync/*` routes return 401 without a device credential.

**E2E:**
- `tests/e2e/till/ui/purchases/return.spec.ts`
- `tests/e2e/till/ui/sale/approval.spec.ts`
- `tests/e2e/portal/catalogue/final.spec.ts`

## Slices

Each slice runs `/tdd-slice`:
1. `test-author` writes the failing tests.
2. `implementer` or `ui-builder` makes them pass.
3. `checker` runs `vp check`, `vp run guard` and `vp test --run`.
4. `reviewer` reviews (Codex is out), and every confirmed finding is fixed.
5. One commit, with human authorship only.

UI slices also run `/ui-screen`, `/ui-verify` and `ui-reviewer`. Adapter and route slices run `/cloud-box-parity`.

0. **Setup:** create the branch, run `vp run services:up`, `db:reset`, migrate and seed, and confirm a green baseline. Commit `docs/plans/day14/plan.md`.
1. **Approvals:**
   - the `sale.price_override` permission, `verifyPin` and `listApprovers`;
   - `GET /sync/approvers`;
   - till step 5, `core/till/approvals.ts`, the refresh, and the host's `approvals.ts`.
2. **Price override, backend:**
   - extract `sales/authority.ts`;
   - sale v4, protocol 4 and till step 6;
   - `till.draft.price` and the server override check;
   - the Notion override test.
3. **Void after tender, backend:** `authorize` in `drafts/status.ts`, and the bridge `approval` field.
4. **Final-sale flag:** migration 0021, catalogue and feed v3, the till decoder, and the back-office switch with its e2e test.
5. **Server refunds:**
   - `refundShare`, migration 0022 and the refund event;
   - `refunds/{accept,lookup}.ts` and the two routes;
   - the Notion tax test and the quantity, accept and lookup tests.
6. **Till refunds:**
   - till step 7 and `till/refunds/*`;
   - the settings window and PIN enforcement;
   - the shared upload worker;
   - host refunds, receipt v2 and its rendering;
   - the report's returns.
7. **Till UI, approvals:** the approval fields, the void dialog and the price override dialog.
8. **Till UI, returns:** the purchases tabs and server search, the detail eligibility card, the return screen and the settings field.
9. **Wrap-up:**
   1. update `docs/engineering/architecture.md` (refunds and approvals, protocol 4) and `testing.md`;
   2. write `docs/plans/day14/{progress,verification}.md`;
   3. run the full suite and a `reviewer` pass on the whole branch;
   4. push, open the PR, check CI, and merge when green;
   5. update the Notion Day 14 row: tasks ticked, Status Done, Remarks covering what shipped, the deviations, known limits and what is left out, and a weekly review re-planning days 15–21.

## Rules at risk

- **Money and tax:**
  - money is integer `mulRatio` only, and the server recomputes and requires an exact match;
  - refunds never read the current tax rule;
  - the golden fixtures are unchanged.
- **Over-refunding:**
  - the till re-checks inside its SQLite transaction, and the server under a `FOR UPDATE` lock;
  - **Known gap:** an offline refund on one till and an online refund of the same line on another can both pay out. One of them is blocked at upload and shows in the sync status.
- **Audit:**
  - every mutation is a `defineCommand`, and `approverId` uses the existing column;
  - the hash format is unchanged;
  - PINs are never stored, PIN hashes never reach audit payloads, and `pin` keys are already redacted.
- **Offline PIN check:**
  - a PIN hash on the till could be brute-forced by anyone who can read the decrypted database. The DPAPI-sealed SQLCipher key is the defence, as on Day 13;
  - a revoked manager can keep approving offline for up to 7 days.
- **Versions:** sale v4, protocol 4 and feed v3 have no upcaster. AGENTS.md says to add one; this is skipped under your reset decision, and Day 11 did the same. The plan and `architecture.md` record why.
- **Boundaries:**
  - core never imports auth; the host passes in the PIN check;
  - new routes live once, in `@shopper/api`;
  - no new dependency, Durable Object or workflow;
  - permissions are data, never role names.
- **File size:**
  - `validate.ts` (194 lines), `purchases.ts` (210) and `host/receipts.ts` (240) stay under 250 through the extractions above;
  - new paths use folders and no hyphens.

## Verification

- **Checks:** `vp check`, `vp run guard`, `vp test --run`, `vp run e2e` and `vp run build` all pass. The `checker` agent reports any failures.
- **Notion tests:** the two required tests pass by name.
- **Manual run:**
  1. sell on the till;
  2. make a partial cash refund with a manager PIN offline (cable out);
  3. reconnect and confirm the refund is accepted on the server, the stock is restored and `audit_log` shows both actor and approver;
  4. refund a sale from another register online.
- **UI:** `/ui-verify` screenshots at five sizes for the return screen, the approval fields, the void and price override dialogs, and the purchases list and detail, compared with Figma 55:2263 and 55:3230.
- **Before push:** a `reviewer` pass on the whole branch, then push, the PR and green CI.
