# Day 19 · GRA E-VAT fiscalisation — plan

## Context

**Notion row:** 19 · GRA E-VAT fiscalisation (Tax, API), P0. **Done when:** fiscalisation never blocks a sale.

The tax engine (Day 18, PR #31, merged as `3c647f5`) already gives every receipt `vatInvoice`, a TIN, credit-note numbers and a pure `fiscalPayload(receipt)` (`packages/core/src/receipts/fiscal.ts`). Nothing sends it anywhere yet. Receipts print a placeholder QR (`packages/hardware/src/format.ts` `qrPayload` / `qrCaption = "E-VAT QR pending"`). Day 19 adds the submission pipeline: a document record, an SDC client behind a port, a per-store FiscalLane that submits in order with retries, the QR on receipts, hourly archive bundles and a portal dashboard.

**Card tasks:** fiscal_doc lifecycle · SDC port + mock · FiscalLane DO (Lane port, DO SQLite queue, alarm backoff, dead-letter, no per-sale Workflow) · box twin under conformance · QR on receipt, provisional when offline, definitive on reprint/email · credit notes fiscalised · six-year hourly archive per store + portal fiscal dashboard · build against a mock SDC (no GRA sandbox keys).

**Required integration tests:** SDC down → sale completes, doc pending → SDC up → accepted · Rejected doc appears on the dashboard · Every accepted doc appears in an archive bundle · Submissions for one store reach the mock SDC in receipt order, even after retries.

### Your decisions (24 Oct)

- **Receipt at sale:** always PROVISIONAL with no E-VAT QR. The signature reaches the till on its next sync. Reprints and the digital receipt then show the definitive receipt with the QR. The till never waits on the SDC.
- **Unregistered shops:** no fiscal_doc for sales or credit notes whose receipt has `vatInvoice: false`. Those receipts print as today, with no QR.
- **Box twin:** an in-process lane per store, recovered from PostgreSQL at boot, matching today's box sequencer, hub and workflows. Rivet replaces it on Day 36.
- **Failures:** backoff of 30s doubling up to 1h. After 10 failed tries (about 6h) the document is dead-lettered and the lane moves on. The dashboard's Retry button (`tax.write`) puts it back at the end of the queue. An SDC _rejection_ is final, not retried.
- **Standing rules:** data is disposable (reset PG, DOs, D1 and till DBs freely). Figma is read-only. **No subagents**: everything runs in this session. Codex review (`codex review -c model="gpt-6.1-sol"`) runs inline before each commit. One commit per slice, one push at the end, then a PR and the Notion remarks. Run `vp check` / `vp check --fix` after each step. Never stage `.claude/settings.json`. No AI attribution.

### What already exists (reuse)

- `fiscalPayload` + `FiscalPayload` type (`core/src/receipts/{fiscal,types}.ts`): `invoice`/`credit_note`, original invoice number, seller TIN, buyer, lines, totals.
- `qrMatrix` (`hardware/src/qr.ts`), `qrImage` (`hardware/src/receipt/parts.tsx`), the ESC/POS `.qr()` (`hardware/src/escpos/receipt.ts:92`) and the placeholder `qrPayload`/`qrCaption` (`hardware/src/format.ts:54-58`).
- Sale and refund commands: `core/src/sales/accept.ts` (`sale.accept`), `core/src/refunds/accept.ts`. The receipt doc is built in `saleDocument` (`vatInvoice` is on the header).
- Coordination DO pattern: `adapters/cf/src/coordination.ts` (`StoreSequencer`, `StoreHub`, SQLite storage), `adapters/cf/src/sequencer.ts` (`getByName(`${orgId}/${storeId}`)`). Box twin pattern: `adapters/box/src/sequencer.ts`, and `workflows/loop.ts` plus `statements.ts` `relaunch()` for boot recovery.
- Workflows: `cloudflareFlow` (`adapters/cf/src/workflows/flow.ts`), `StatementWorkflow` as the shell template, `boxLoopFlows`, `memoryWorkflow`, and `WorkflowLauncher` start-is-idempotent.
- Feed: `recordChanges` / `affectedStores` (`core/src/changes/record.ts`, `FEED_VERSION = 5`) and `storeChangeEntities` (`db/pg/src/schemas/changes.ts`).
- Conformance: `packages/conformance` (`portConformance`, per-port case files), box runner `tests/integration/ports/conformance.test.ts`, workerd runner `tooling/worker/tests/*` (driven by `tests/integration/edge/worker.test.ts`).
- Blobs port (org-scoped `put`/`signedUrl`) for archives. `sha256` from `@shopper/utils`.
- Portal report pattern: `backoffice/screens/tax/*` (Day 18), the `routes/tax.tsx` tabs, Gate/BranchPicker/OfflineNote/skeletons/shortcuts.
- Permissions: `tax.read`, `tax.write` (`auth/roles/defaults.ts`).

### Figma

The six links are the same pages as Day 18 (Componets, Dashboard, Barcode Scanner, New Login, Web Flow 227:4900, Login). **No fiscal frames exist.** The dashboard follows "Previous purchases" (45:852): segment tabs with counts, a search box, and a table with status badges. The till receipt keeps the existing layout, and the purchase detail (45:852, right frame) gains a fiscal badge. Inputs follow 12:66. The missing frames go in the remarks. Figma is never edited.

---

## Slices (each one: tests first → implement → `vp check` · `vp run guard` · targeted tests → codex review → commit)

### Slice 0 — Branch and reset

- In this worktree: `git switch -c day19-fiscal origin/main`, `vp install`, `vp run services:up`, `vp run db:reset && vp run db:migrate && vp run db:seed`. Fast-forward local `main` to `origin/main`.

### Slice 1 — fiscal_doc, the SDC port and the mock SDC

- **Migration `0027_fiscal.sql`** (forward-only, idempotent) and Drizzle `db/pg/src/schemas/fiscal.ts`:
  - `fiscal_doc`: `id` uuid v7, `org_id`, `store_id`, `branch_id`, `kind` (`invoice`|`credit_note`), `sale_id` / `refund_id` (exactly one set), `invoice_number`, `payload jsonb` (FiscalPayload), `status` (`pending`|`submitted`|`accepted`|`rejected`|`dead`), `attempts int`, `last_error`, `sdc_id`, `sdc_counter`, `signature`, `qr`, `signed_at`, `rejection_code`, `rejection_message`, `archive_id`, `created_at`, `accepted_at`. Unique `(org_id, sale_id)` and `(org_id, refund_id)`; index `(org_id, store_id, status)`.
  - `fiscal_archive`: `id`, `org_id`, `store_id`, `hour timestamptz`, `key`, `doc_count`, `sha256`, `bytes`. Unique `(org_id, store_id, hour)`.
- **Ports** (`ports/src/types.ts`):
  - `Sdc { submit(doc: { invoiceNumber; payload: Json }): Promise<{ status: "accepted"; sdcId; counter; signature; qr; signedAt } | { status: "rejected"; code; message }> }`. Transport errors and 5xx throw `SdcUnavailable`.
  - `Lane { enqueue(orgId, storeId, docId): Promise<void> }`.
  - Valibot result schema in `ports/src/schemas/fiscal.ts`.
- **HTTP client** `core/src/fiscal/sdc.ts` `httpSdc({ url, key, fetch })`: plain `fetch`, so it runs on both runtimes. It validates the response once at this boundary and is idempotent by invoice number. It is a partner client, not a platform binding, so it does not belong in adapters.
- **Mock SDC** `tooling/fiscal/mock.ts`: a Hono app on Bun/Node HTTP. It records arrivals and returns the same signature for a repeated invoice number. Test controls: `down()`, `up()`, `reject(invoiceNumber, code)`, `failNext(n)`. The QR is a URL-shaped string. Tests and the Playwright web server reuse it, and `vp run dev` can start it, so dev works end to end.
- **Tests first:** `tests/integration/fiscal/sdc.test.ts`: accepted and rejected shapes, down → `SdcUnavailable`, a repeat submission returns the same signature.

### Slice 2 — Documents from sales and credit notes, and the shared submit step

- In `sale.accept` and `refund.accept`, when the receipt's `vatInvoice` is true, insert a `pending` fiscal_doc (payload = `fiscalPayload(receipt)`) **in the same transaction**. The command output carries `fiscalDocId`. A replay returns the existing id.
- `core/src/fiscal/submit.ts` `submitFiscalDoc(db, sdc, docId, now)` returns `"done" | "retry"`. Each transition is a `defineCommand` with an audit row:
  - mark `submitted` (attempts+1);
  - accepted → store the signature fields, set `accepted_at`, `recordChanges` a `fiscal-doc` change to the store feed, and after commit start the archive workflow for that store-hour;
  - rejected → `rejected` with code and message (final);
  - `SdcUnavailable` → back to `pending` with `last_error`, `"retry"`; on the 10th failure → `dead`.
- `core/src/fiscal/retry.ts` `retryFiscalDoc` (`tax.write`): dead → pending, attempts 0, audited.
- After a sale/refund upload returns, the sync routes (`api/src/sync/*`) call `deps.lane?.enqueue(orgId, storeId, fiscalDocId)`. Backstop: the existing daily watchdog sweeps pending docs older than 15 minutes into their lanes. `ponytail:` it covers a crash between commit and enqueue; a per-minute sweep is the upgrade if that ever matters.
- **Tests first** `tests/integration/fiscal/documents.test.ts`:
  - a registered sale creates one pending invoice doc whose payload equals `fiscalPayload`;
  - a credit note creates a `credit_note` doc naming the original invoice;
  - an unregistered shop creates none;
  - a replayed upload creates no second doc.

### Slice 3 — FiscalLane (cf DO and box twin) with conformance

- **Lane semantics** (shared, in `core/src/fiscal/lane.ts`): a store's queue is FIFO by enqueue position, and enqueue is idempotent by docId. The head is retried until done or dead, so a retry never lets a later doc overtake. Backoff is `min(30s·2^(n-1), 1h)`; 10 tries, then dead and move on. Both adapters only own storage and timing.
- **cf** `FiscalLane` in `adapters/cf/src/coordination.ts`:
  - DO SQLite table `queue(position INTEGER PRIMARY KEY AUTOINCREMENT, doc_id TEXT UNIQUE, attempts, next_at)`;
  - `enqueue` → `INSERT OR IGNORE` + `setAlarm(now)` if none;
  - `alarm()` drains the head through `submitFiscalDoc` over Hyperdrive, then sets the next alarm.
  - Adapter `cloudflareLane(binding)` uses `getByName(`${orgId}/${storeId}`)`.
  - Add the binding `FISCAL_LANE` + `exports.durableObject({ storage: "sqlite" })` in `apps/edge/cloudflare.config.ts`, and export it from `apps/edge/src/index.ts`.
  - The DO reads `SHOPPER_SDC_URL` / `SHOPPER_SDC_KEY`. When they are unset, the runtime does not wire the lane and docs stay pending (the dashboard says the SDC isn't connected).
  - Check whether `cf` config allows an optional secret. If not, set a placeholder on every staging Worker before pushing (memory: worker-secrets) and put it in the upgrade notes.
- **box** `adapters/box/src/lane.ts` `boxLane(db, sdc)`: one in-process promise chain per store. Order comes from enqueue order, with timers for backoff. `relaunch()` at boot re-enqueues every pending/submitted doc by `created_at`. Wire it in `apps/box/src/app.ts` next to `boxStatementFlows`. `ponytail:` in-process timers; Rivet actor on Day 36.
- **Conformance** `packages/conformance/src/cases/lane.ts` `laneConformance(name, test, fixture)`, run by the box runner and the workerd runner (`tooling/worker/tests/lane.test.ts`) against the mock SDC:
  - **"Submissions for one store arrive at the mock SDC in receipt order, even after retries"**: five docs, with the SDC failing the 2nd twice; arrivals are R1…R5 and each is accepted once;
  - dead-letter after 10 failures, after which the next doc proceeds;
  - a duplicate enqueue submits once;
  - two stores don't block each other;
  - the lane survives a reopen (box relaunch / DO eviction).
- `docs/engineering/platforms.md`: FiscalLane is now implemented; the five-class count is unchanged.

### Slice 4 — QR on receipts, provisional then definitive (till)

- **Receipt document v5** (`core/src/schemas/receipts/document.ts`): add `fiscal: null | { status: "provisional" } | { status: "signed"; sdcId; counter; signature; qr; signedAt }`, with a v4→v5 upcaster (`null`). `buildReceipt` / `buildRefundReceipt` set `provisional` when `vatInvoice`, otherwise `null`.
- **Feed v6:** add a `fiscal-doc` entity to `storeChangeEntities` (migration in 0027). The payload is `{ saleId | refundId, sdcId, counter, signature, qr, signedAt }`. Add the v5→v6 upcaster, the till decoder in `schemas/till/reference.ts`, and a till SQLite table `fiscal_signature` (`packages/db/sqlite/src/schemas/till/fiscal.ts`) written on pull.
- **Renderers** (`hardware/src/format.ts`, `escpos/receipt.ts`, `receipt/view.tsx`):
  - `provisional` → no QR, caption "PROVISIONAL — E-VAT signature pending";
  - `signed` → QR of `fiscal.qr` + "SDC {sdcId} · #{counter}";
  - `null` → nothing.
  - Credit notes print the QR too. The `qrPayload`/`qrCaption` placeholders are deleted.
- **Definitive copy:** the till merges the signature into the stored receipt JSON when it pulls. A reprint renders the definitive receipt. If the sale has a digital receipt, the till re-renders the PDF and re-uploads it through the existing `receipt_output` upload path, so the link serves the definitive copy. _Check during the slice that `confirmReceiptUpload` replaces the sale's asset; if it doesn't, add a `supersedes` handling there, never a server-side re-render._
- Till purchases list/detail (`apps/till/ui`): a "Provisional" / "E-VAT signed" badge.
- **Tests first:**
  - `tests/integration/till/fiscal/receipt.test.ts`: a sale prints provisional (ESC/POS bytes contain the caption and no QR command); after pull of the signature, a reprint contains the QR payload; an unregistered sale has neither.
  - Renderer conformance still passes.
  - Feed upcaster test.

### Slice 5 — Six-year archive in hourly bundles

- `core/src/fiscal/archive.ts` `runFiscalArchive(flow, deps, { orgId, storeId, hour })`:
  - `sleepUntil(hour end + 5 min)`;
  - one step bundles every `accepted` doc of the store with `archive_id IS NULL AND accepted_at < hour end`. Late stragglers fall into the next bundle, so none is missed. Docs are written as JSONL in invoice order;
  - `blobs.put(orgId, "fiscal/{storeId}/{yyyy}/{mm}/{dd}/{hh}.jsonl")`;
  - in one transaction: insert `fiscal_archive` (count, sha256, bytes), set `archive_id` on the docs, write an audit row, update `workflow_run`.
  - Instance id `fiscal-archive:{orgId}:{storeId}:{yyyymmddhh}`, the business key. Start is idempotent, so every acceptance in that hour just calls start.
- **cf:** `FiscalArchiveWorkflow` shell like `StatementWorkflow`, plus the `FISCAL_ARCHIVE` workflow binding/export. Archives go to the existing `BLOBS` bucket under `fiscal/`. Six-year retention is an R2 lifecycle rule on that prefix (upgrade notes); no new bucket.
- **box:** a `boxLoopFlows`-style launcher with `relaunch()` for stores that have unarchived accepted docs. Blobs go to RustFS/filesystem as today.
- **Tests first** `tests/integration/fiscal/archive.test.ts`: **"Every accepted doc appears in an archive bundle"**. Accept docs across two hours plus one accepted late. After the workflows run (memory clock), the union of the bundles' lines equals the set of accepted docs exactly once, and each bundle's sha256 matches its stored bytes.

### Slice 6 — Fiscal API and portal dashboard

- **API** `api/src/routes/tax/fiscal.ts` (mounted under `/tax`):
  - `GET /tax/fiscal?status&branchId&q&cursor` (`tax.read`): counts per status, a page of docs, and whether the SDC is connected;
  - `GET /tax/fiscal/:id` (`tax.read`): the document with its payload, attempts, last error and rejection;
  - `POST /tax/fiscal/:id/retry` (`tax.write`): dead → pending, then `lane.enqueue`;
  - `GET /tax/fiscal/archives?storeId&date` (`tax.read`): bundles with a signed download URL.
- **Portal** Tax → **Fiscal** tab, `backoffice/screens/tax/fiscal/screen.tsx`, `components/tax/fiscal/*`, `queries/tax/fiscal/*`:
  - segment tabs with counts: All · Pending · Accepted · Rejected · Dead-lettered;
  - search by receipt number, BranchPicker, and a table (receipt #, type, branch, issued, status badge, tries, reason);
  - a detail sheet with the rejection/last error and a Retry button for dead docs (shown only with `tax.write`);
  - an "SDC not connected" banner;
  - an Archive section: hourly bundles for a day, with download.
  - Every state is designed: skeleton (`/skeleton-audit`), empty, error, offline note. Keyboard: tabs 1–5, `/` search, `R` retry in the sheet. No effects.
- **Tests first:**
  - `tests/integration/fiscal/dashboard.test.ts` **"Rejected doc appears on the dashboard"**: the mock SDC rejects one invoice, and `GET /tax/fiscal?status=rejected` lists it with code and message while the Rejected count is 1;
  - permission checks (a cashier gets 403; an admin cannot retry without `tax.write`);
  - retry audits and re-submits.
  - e2e `tests/e2e/portal/tax/fiscal.spec.ts`: the dashboard shows the rejected doc; Retry on a dead doc moves it to Accepted.

### Slice 7 — Done-when, docs and verification

- **Done-when integration** `tests/integration/fiscal/outage.test.ts` **"SDC down → sale completes, doc pending → SDC up → accepted"**: the mock SDC is down; a golden sale uploads and returns 200 with the doc pending; the receipt is provisional; the SDC comes up; the lane alarm or timer fires; the doc is accepted, the till pulls the signature and the reprint carries the QR.
- e2e: a till sale completes and prints while the SDC is down, then the portal dashboard shows it Pending → Accepted.
- Docs:
  - `docs/engineering/architecture.md`: a fiscal section covering the lifecycle, lane semantics, archive and provisional receipts;
  - `platforms.md`: the FiscalLane row and the `SHOPPER_SDC_*` config;
  - `deployment.md`: upgrade notes;
  - `docs/plans/day19/{plan.md,verification.md,screenshots/}`.
- Event and version bumps (receipt v5, feed v6), with the upcasters tested and the version pins updated. As before, reset dev data and till DBs instead of migrating stored payloads.

---

## Verification

- Per slice: the targeted `vp test --run tests/integration/fiscal/...`, `vp check`, `vp run guard`. Break each Notion test once on purpose and watch it go red:
  - let the lane skip a failing head (order test);
  - skip the straggler sweep (archive test);
  - drop the rejection write (dashboard test);
  - await the SDC inside `sale.accept` (outage test).
- Workerd: `tests/integration/edge/worker.test.ts`, which runs the lane conformance in workerd against the mock SDC.
- Full run at the end: `vp test --run` (all integration), the portal and till Playwright suites, `vp run build`.
- UI: the `/ui-verify` loop with `playwright-cli` on the real portal (fiscal dashboard: every tab, empty, loading, error, offline, detail sheet, retry) and the till (provisional vs signed receipt preview, purchase badge). Screenshots at desktop, laptop, tablet, mobile and till (1366), with console, overflow and accessibility checks. Then a `/skeleton-audit` on the fiscal tab.
- Review: `codex review -c model="gpt-6.1-sol"` per slice and on the whole branch, with each finding checked against the rules (the `/pre-merge-review` checklist, run inline).
- Finish: the commits already exist per slice → one `git push -u origin day19-fiscal` → open the PR (no attribution) → bind it with the ccd_pr tools and read CI.
- Then update the Notion Day 19 row: Status Done, tick the tasks and tests, and add remarks in the Day 18 format (status, your decisions, shipped, tests, review, decisions to confirm, upgrade notes, known limits, missing Figma frames, process note).

## Upgrade notes (expected)

- Migration `0027_fiscal`. Receipt doc v5 and feed v6: let tills upload, update them, then reset dev data and till DBs.
- New DO class `FiscalLane` (the planned 4th of the five) and workflow `FiscalArchiveWorkflow` on edge.
- `SHOPPER_SDC_URL` / `SHOPPER_SDC_KEY` are optional: unset means docs queue as pending. Placeholders go on staging if the config needs them declared.
- An R2 lifecycle rule for 6-year retention on `fiscal/` in the assets bucket.
- Real GRA endpoint: swap the mock contract once sandbox access is granted.
