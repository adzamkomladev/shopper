# Day 18 · Tax module — plan

## Context

**Notion row:** 18 · Tax module (Tax, Portal), P0. Goal: tax as a first-class product feature.
**Done when:** the accountant can file a VAT return straight from Shopper's worksheet.

**Card tasks**

1. Tax settings: business TIN, VAT registration, pricing mode (inclusive by default, exclusive option), cash rounding.
2. Dated rule editor (super admin only, audited, effective-from date).
3. Discounts before tax; refunds issued as credit notes with reversed tax.
4. Reports: tax summary by period / class / branch; VAT return worksheet (output VAT, NHIL, GETFund, zero-rated, exempt); Excel export.

**Required integration tests:** "A rate change dated tomorrow does not touch today's sales" · "Credit note reverses tax exactly" · "VAT return worksheet equals the sum of line snapshots for the fixture month". Done-when becomes a portal e2e.

### Owner decisions (24 Oct)

- **Price mode:** an org setting, inclusive (default) or exclusive, for the whole price list. Tills quote in that mode and the server accepts either mode when the arithmetic is right. Separately, an invoice to a TIN buyer always shows net unit prices with VAT/NHIL/GETFund broken out. What a customer pays never depends on who they are.
- **Not VAT-registered:** registration is dated (`vatRegisteredFrom`). Before that date, or with no date set, lines carry zero tax (recorded in the snapshot), the receipt says RECEIPT instead of VAT INVOICE, no TIN prints, and the worksheet shows nothing due.
- **Credit notes:** each one gets its own number from the till's receipt block (works offline, unique per org). It prints as CREDIT NOTE against the original invoice. The fiscal payload carries `type: "credit_note"` and the original invoice number.
- **Worksheet:** the output side comes from line snapshots. The accountant types in the input VAT claimed for the period, the sheet shows net payable, and it exports to .xlsx.
- **Standing rules:** data is disposable (reset the DB, DOs and till DBs freely). Figma is read-only. **No subagents:** all work runs in this session. **Codex review** (`codex review -c model="gpt-6.1-sol"`) runs inline before each commit. One commit per slice, one push at the end, then a PR and the Notion remarks.

### What already exists (reuse, don't rebuild)

- `packages/tax/src/snapshot.ts` `snapshotLine` / `snapshotAmount`: inclusive/exclusive breakdown, with the discount taken off before tax (`taxable = amount − discount`). `refundShare` in `refund.ts` gives the exact cumulative pro-rata tax reversal.
- `tax_rule` table (`packages/db/pg/src/schemas/catalogue.ts`), one row per `(org, effective_from)`, seeded from `ghana2026`. Sale lines freeze the rule in `sale_line.payload.tax`.
- Server validation is in `packages/core/src/sales/validate.ts` (`validateReferences`, which currently **rejects** `priceMode !== "inclusive"`) and `sales/labels.ts` `expectedLine`. The till quotes in `packages/core/src/till/quotation.ts` (priceMode is hard-coded to `"inclusive"`).
- Org settings: `org.cashRounding` exists but has no UI. It reaches tills only through the snapshot (`changes/snapshot.ts`) and is stored as the `org-setting` reference row (`till/settings.ts`). There is **no feed change** for org settings or tax rules.
- Feed tools: `recordChanges` and `affectedStores` (`changes/record.ts`); `taxRuleUpsert` and `deleted` (`changes/project.ts`); `FEED_VERSION = 4`, decoded in `schemas/till/reference.ts`.
- Receipts: `receipts/build.ts` (`buildReceipt`, `buildRefundReceipt`, `common`), receipt doc v3 (`schemas/receipts/document.ts`) with an upcaster chain, `receipts/fiscal.ts`, and the renderers `packages/hardware/src/escpos/receipt.ts` and `receipt/view.tsx` (today they print "REFUND"). The seller TIN comes from the till host config `receiptReference.tin`.
- Receipt numbers: `till/receipts/assign.ts` `assignReceipt`.
- Settings pattern: `defineCommand` + `readX/setX` (`customers/credit/settings.ts`), `api/routes/settings.ts`, `backoffice/queries/settings/resource.ts`, `components/settings/page.tsx`, `routes/settings.tsx`.
- Permissions: `tax.read` and `tax.write` already exist. Only `superadmin` holds `tax.write` (`auth/roles/defaults.ts`), so "super admin only" means `requirePermission("tax.write")`.
- Excel: `xlsx` (SheetJS) is already a dependency of `@shopper/core`, used in `catalogue/import/parse.ts`. CSV export pattern: `api/routes/customers.ts` `/customers/export.csv`.
- Report screen pattern: `backoffice/screens/inventory/valuation/screen.tsx` (Gate, BranchPicker, OfflineNote, skeletons, shortcuts).
- Tests: `tests/integration/**`, golden sale fixtures (`tests/fixtures/sales/golden`, `tests/support/sales/golden/{setup,run}.ts`), refund helpers (`tests/support/sales/refunds.ts`). Existing `tests/integration/sales/refunds/tax.test.ts` covers the pro-rata reversal.
- Dead code found: `store.cash_rounding_step` is edited in the store form but never read at sale time. It duplicates the new setting, so it is removed (slice 1).

### Figma

The six links are pages: Componets, Dashboard, Barcode Scanner, New Login, Web Flow and Login. Web Flow (227:4900) and Dashboard contain only till register frames. **No tax, settings or report frames exist.** Tax screens are built from the portal's existing Settings and Inventory valuation patterns with Componets tokens. The till credit-note print uses the existing receipt layout. This gap goes in the remarks.

---

## Slices (each: tests first → implement → `vp check` · `vp run guard` · targeted tests → codex review → commit)

Run `vp check` (and `vp check --fix` for formatting and lint autofixes) after every meaningful step inside a slice, not just at the end. That keeps the guard, type and lint errors small and local.

### Slice 1 — Tax settings and the org-setting feed

- **Migration `0026_tax.sql`** (forward-only, idempotent):
  - `org.tin text null`, `org.vat_registered_from date null`, `org.price_mode text not null default 'inclusive'` with a check `('inclusive','exclusive')`. A VAT-registered org needs a TIN: check `vat_registered_from IS NULL OR tin IS NOT NULL`.
  - Table `vat_return(id, org_id, period char(7) 'YYYY-MM', input_vat, input_nhil, input_getfund moneyColumns, times)`, unique `(org_id, period)`.
  - (`store.cash_rounding_step` stays: removing it would mean rewriting the money round-trip schema test. It is a follow-up in the remarks.)
  - Update the Drizzle schema in `db/pg/src/schemas/base.ts` and add `schemas/tax.ts` for `vat_return`.
- **Core** `packages/core/src/tax/settings.ts`:
  - `readTaxSettings` and `setTaxSettings` (`defineCommand "tax.settings.set"`, audit before/after).
  - Valibot schema in `core/src/schemas/tax/settings.ts`, reusing `tinSchema` from `schemas/customers/inputs.ts`.
  - `setTaxSettings` emits an `org-setting` upsert change to every store (`affectedStores` + `recordChanges`).
- **Feed v5:**
  - Add `"org-setting"` to `storeChangeEntities`.
  - `tillOrgSetting` becomes `{id, cashRounding, priceMode, vatRegisteredFrom, tin, orgName}`.
  - Snapshot v5's `reference.settings` replaces the bare `cashRounding`.
  - Add v4→v5 upcasters (a v4 change is unchanged; a v4 snapshot's `cashRounding` maps into settings with inclusive pricing, `vatRegisteredFrom: "2026-01-01"` and TIN null).
  - `till/settings.ts` gains `storeOrgSettings` / `readOrgSettings`; `readCashRounding` reads from them.
  - Update `packages/conformance` if the feed contract test pins the version.
- **API:** `GET /settings/tax` (`tax.read`), `PUT /settings/tax` (`tax.write`) in `api/routes/settings.ts`.
- **Tests (first):** `tests/integration/tax/settings.test.ts`:
  - PUT refused without `tax.write` (an admin gets 403).
  - Saving writes an audit row.
  - A registered org without a TIN is refused.
  - The change reaches a till through pull and the till's org settings match.

### Slice 2 — Tax engine: registration and price mode

- `@shopper/tax` `snapshotLine` takes `registered: boolean`. When it is false, every rate is zero and the snapshot records `registered: false` (the taxClass is kept). Exclusive mode already works.
- Sale event version bump. Find the current `v` in `schemas/till/sale.ts`; add `tax.registered` with an upcaster that defaults it to `true` for older events. Refund snapshots copy it through `refundShare`.
- Till `quotation.ts`: `priceMode` and `registered` (`vatRegisteredFrom != null && on >= vatRegisteredFrom`) come from org settings.
- Server `validate.ts`:
  - Drop the inclusive-only rejection.
  - Require `line.tax.registered` to equal the org's registration on the sale date.
  - Accept either `priceMode`. `expectedLine` already re-derives through `snapshotLine(line.tax)`, so a wrong mode or wrong arithmetic fails there.
  - Label (weighed/priced barcode) lines stay `snapshotAmount` inclusive, because a label's price is what the customer pays. This is documented.
- **Tests (first)** `tests/integration/tax/engine.test.ts`:
  - Exclusive org: the till quote and the server accept, with gross = base + VAT + NHIL + GETFund.
  - Line discount is taken before tax in both modes (tax equals the rate × the discounted base).
  - Unregistered org: lines have zero tax, the server accepts them, and it rejects a taxed line forged by hand.
  - Registered org: the server rejects a zero-tax line.
  - Registration dated tomorrow: today's sale is untaxed and tomorrow's quote is taxed.

### Slice 3 — Dated rule editor

- **Core** `packages/core/src/tax/rules.ts`:
  - `listTaxRules`.
  - `createTaxRule` (`defineCommand "tax.rule.create"`): `effectiveFrom` must be **after today in Accra** (use `ghanaDate`), rates in bps 0–10000, a source note is required, and the date must be unique per org.
  - `updateTaxRule` and `deleteTaxRule`: allowed only while the rule is not yet effective. The FK already blocks deleting a rule that sales used.
  - Each command emits a `tax-rule` upsert/delete change to every store and writes an audit row.
- **API** `api/routes/tax/rules.ts`: `GET /tax-rules` (list, `tax.read`; the existing `?on=` lookup stays), `POST /tax-rules`, `PATCH /tax-rules/:id`, `DELETE /tax-rules/:id` (`tax.write`).
- **Tests (first)** `tests/integration/tax/rules.test.ts`:
  - **"A rate change dated tomorrow does not touch today's sales"**: an owner creates a rule for tomorrow with a different VAT. Today's sale, already synced and new, uses the current rule and its stored `sale_line` payloads are byte-identical before and after. A till quote at tomorrow 00:00 Accra uses the new rule. The server rejects a today-dated sale carrying the new rule.
  - A rule dated today or in the past is refused.
  - A non-superadmin gets 403.
  - Editing or deleting an effective rule is refused.
  - Audit rows are written.
  - The till receives the rule through pull.

### Slice 4 — Credit notes and the B2B invoice view (receipt v4)

- The till refund flow (`till/refunds/record.ts`) calls `assignReceipt` for `creditNoteNumber`. It is added to the refund snapshot (refund event version bump plus upcaster: older events get null) and stored as `refund.credit_note_number`, unique per org.
- **Receipt document v4:**
  - `kind: "sale" | "credit_note"`, upcasting `"refund"` to `"credit_note"`.
  - `header.receiptNumber` holds the credit-note number. `creditNoteFor` replaces `refundOf`.
  - `header.vatInvoice: boolean` (true when registered on that date): the title is VAT INVOICE or RECEIPT, and the TIN prints only when registered.
  - The header's org name and TIN come from org settings, not host config.
  - Lines get `net` (ex-tax line amount), rendered only when `buyer` is set (the B2B view).
  - Add the v3→v4 upcaster. Totals stay positive amounts on the credit note.
- `fiscal.ts`: `type: "invoice" | "credit_note"` plus `originalInvoiceNumber`.
- Renderers (`escpos/receipt.ts`, `receipt/view.tsx`): CREDIT NOTE title, "Credit note for <invoice>", the reversed tax summary, net columns for B2B, and VAT INVOICE vs RECEIPT.
- **Tests (first)**:
  - `tests/integration/tax/credit/note.test.ts` **"Credit note reverses tax exactly"**: a full refund's credit note tax equals the sold snapshot per component. Two partial refunds sum to the line exactly. Each has its own number, distinct from sales. The fiscal payload is `credit_note` with the original number. Replaying the refund returns the same number.
  - B2B receipt test in `tests/integration/receipts/`: lines show net while totals are unchanged.
  - Hardware render test for CREDIT NOTE and RECEIPT for unregistered orgs.
  - Update the existing receipt and refund expectations.

### Slice 5 — Reports, worksheet and Excel export

- **Core** `packages/core/src/tax/reports/{summary,worksheet,export}.ts`:
  - **Summary** `(from, to, groupBy: day|month, branchId?)` gives rows by period × tax class × branch. Each row has base, VAT, NHIL, GETFund, COVID and gross, sales less credit notes. It sums `sale_line.payload->'tax'` jsonb components through Drizzle `sql` with `::bigint` over completed sales, keyed by `tax.on`, and `refund_line.payload->'tax'` keyed by the refund's Accra date (`occurred_at AT TIME ZONE 'Africa/Accra'`).
  - **Worksheet** `(period YYYY-MM)` returns:
    - standard-rated sales (base), output VAT, NHIL, GETFund, COVID;
    - zero-rated value and exempt value;
    - credit notes, each component broken out;
    - net output;
    - input VAT, NHIL and GETFund from `vat_return`;
    - net payable.
      It sums snapshots in Postgres and does the arithmetic through `@shopper/money`.
  - `setVatReturnInput` (`defineCommand "tax.return.input"`, audited).
  - **Export** builds an .xlsx with SheetJS (`XLSX.utils.aoa_to_sheet`). Sheets: "VAT return" (the worksheet in GRA return order), "Sales by class", "Credit notes" (number, original, date, components). Amounts are GHS decimals formatted from integer money, with `formatMoney` from `@shopper/money` (check the export name).
- **API** `api/routes/tax/reports.ts` (`report.read` + `tax.read`):
  - `GET /tax/summary`
  - `GET /tax/returns/:period`
  - `PUT /tax/returns/:period/input` (`tax.write`)
  - `GET /tax/returns/:period/export.xlsx`
- **Tests (first)** `tests/integration/tax/worksheet.test.ts`:
  - **"VAT return worksheet equals the sum of line snapshots for the fixture month"**: golden sales across standard, zero-rated and exempt classes and two branches, a discounted line, a credit note, and one sale in the next month plus one in the previous month. The worksheet equals a fold of the stored snapshots for the month; the fold reads the DB rows, not a recomputation.
  - The parsed xlsx equals the API figures.
  - Input VAT is saved, audited, and changes net payable.
  - Summary grouping by class and by branch equals the fold.
  - An unregistered org shows nothing due.

### Slice 6 — Portal screens (`/ui-screen` then `/ui-verify` with playwright-cli)

- `screens/settings/tax/screen.tsx` and `components/settings/tax/form.tsx`: TIN, VAT registered from (date), price mode (radio), cash rounding (none/10p). Read-only for users without `tax.write`. Route added in `routes/settings.tsx`, query added to `queries/settings/resource.ts`.
- `screens/tax/rules/screen.tsx`: table of rules (effective from, VAT, NHIL, GETFund, COVID, source, status: current, scheduled or past), "New rule" dialog (shortcut N), edit/delete on scheduled rules only. Queries live in `queries/tax/rules.ts`.
- `screens/tax/summary/screen.tsx`: date range and grouping, BranchPicker (B), tiles (output tax, credit notes, net) and a table.
- `screens/tax/returns/screen.tsx`: month picker, worksheet sections, input VAT form, net payable, "Export to Excel" (shortcut E).
- `routes/tax.tsx` plus nav entries "Tax" (Summary, VAT return, Rules) and "Settings → Tax". Every state is built: loading skeletons sized to the real layout (`/skeleton-audit`), empty, error, offline, no permission.
- **Tests:** `tests/e2e/portal/tax/*.spec.ts` covering settings save, rule create, and the **done-when** e2e "The accountant can file a VAT return from the worksheet" (fixture month sales, open the return, enter input VAT, net payable is right, download the xlsx and parse it), with screenshots at desktop, laptop, tablet, mobile and till sizes.

### Slice 7 — Till

- Till UI shows CREDIT NOTE with its number in the refund confirmation and reprint. The receipt preview shows VAT INVOICE or RECEIPT.
- Till e2e: refund → credit-note print preview, with the number and reversed tax.

### Slice 8 — Wrap-up

- Docs: update `docs/engineering` where tax rules and contracts changed (feed v5, receipt v4, sale/refund versions, price mode, registration). Write `docs/plans/day18/{plan.md,verification.md,screenshots}`.
- Full `vp check`, `vp run guard`, `vp test --run`, and the e2e suites. Fix everything.
- Final `codex review` over the whole branch; fix confirmed findings.
- Push `day18-tax` once, open a PR to `main`, check CI with the ccd_pr tools.
- Update the Notion Day 18 row: Status Done, ticked tasks and tests, Remarks in the Day 17 format (shipped, tests, review, decisions, upgrade notes, known limits, no Figma frames).
- Update memory: Codex is available again; no subagents for Day work.

## Verification

- Integration: `vp test --run tests/integration/tax` and the affected `sales`, `receipts`, `till`, `sync` and `hardware` suites, then the full run against the Postgres 18 fixture (`vp run services:up`, `vp run db:migrate`, after resetting dev and till data).
- Break each Notion test once on purpose and watch it go red:
  - let a till use the newest rule regardless of date;
  - drop one component in the credit note;
  - include next month's sales in the worksheet.
- `vp run dev`: as superadmin, set the tax settings, add a rule for tomorrow, make sales on the till (inclusive, then exclusive, then unregistered), refund one, open the VAT return, enter input VAT, export the xlsx and open it. Run the `/ui-verify` loop at all five sizes with console and overflow checks.

## Upgrade notes (for remarks)

- Migration `0026_tax`. Reset dev data and the till databases: feed v5, receipt v4, and the sale and refund versions change.
- No new secrets, DOs or Workflows. Feed and receipt changes go to both adapters through the shared core.

---

## Changes made while building (24 Oct)

- **Registration default.** A shop that never gave a registration date counts as registered since `2000-01-01`
  (`registeredSince` in `@shopper/tax`), not the statutory 2026 start. Fixtures dated 2025 would otherwise have
  sold untaxed. There is no DB constraint that a registered org has a TIN: provisioning cannot know it, so the tax
  settings command requires it, and receipts print no TIN until the owner enters one.
- **`tax.return`.** Filing the input tax needs its own permission (accountant, admin, super admin), because
  `tax.write` is super-admin only and the accountant files the return.
- **Routes.** The rule editor is `/tax/rules[/:id]` (the guard wants nested paths); `/tax-rules?on=` stays as the
  published lookup. The shared runtime had to route `/tax/*` behind the session.
- **`store.cash_rounding_step`** stays. It is unused at sale time, but removing it means rewriting the money
  round-trip schema test. That is a follow-up.
- **Receipt kind** stays `"sale" | "refund"`; a refund prints as CREDIT NOTE with its own number in
  `header.receiptNumber`.
- **The worksheet test** uses one branch (the golden world has one register), and its month boundary is
  30 Sep / 1 Oct, because the server dates no sale after its own clock.
