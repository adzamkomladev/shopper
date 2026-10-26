# Architecture and import boundaries

Read this before adding a file, a package, or a dependency between two projects.
`vp run guard` enforces every rule marked **(guard)**. CI fails on any violation.

## The three kinds of project

| Folder       | What lives there                                                                                   | May import                                            |
| ------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `apps/*`     | Deployable things: a Worker, the box binary, an SPA, the till shells. Composition and wiring only. | `packages/*` only                                     |
| `packages/*` | All business logic, contracts, schemas, UI components, adapters. Each package has one job.         | Other `packages/*`, in one direction only (no cycles) |
| `tooling/*`  | Developer experience: scripts, the guard, seeds, dev services, test runners. Never shipped.        | Anything                                              |
| `tests/`     | Integration and e2e suites (`@shopper/tests`). See [testing.md](testing.md).                       | `packages/*`, `apps/*` entry points, `tooling/*`      |

Rules:

- **An app never imports another app (guard).** If two apps need the same code, move it into a
  package. Apps that cooperate at runtime, such as `till-electron` starting `till-host`, talk over a
  Valibot-checked message contract (IPC, WebSocket or HTTP), never by importing each other.
- **A package never imports an app (guard).** Packages do not know who deploys them.
- **Nothing shipped imports tooling (guard).** The one exception is build configuration
  (`*.config.ts`), which may read `tooling/build/info.ts` and use build plugins.
- **Package dependencies are acyclic (guard).** If two packages need each other, the shared part is
  a third, lower package.
- **Import packages by name (guard).** Write `@shopper/auth/devices`, never `../../packages/auth/src/devices`.
  A relative import may not leave its own project. Expose what others need through `exports` in
  `package.json`.
- **Declare what you import (guard).** Every `@shopper/*` import must be listed in that project's
  `package.json`.

## Package layers

Import downwards only. A package may import its own layer (without a cycle) or any lower layer,
never a higher one. The current dependency graph follows this table; keep it that way.

```text
5  adapters/cf, adapters/box               platform code (the only place for Cloudflare and Rivet)
4  api, backoffice, sync, export           use cases exposed over HTTP, UI or files
3  core, auth, audit, assets, hardware             commands, policies, domain rules
2  ports, db/pg, db/sqlite, conformance    contracts and schemas
1  money, tax, config, ui, utils                  leaves: pure logic, constants, components
```

`ui` is a leaf: it holds presentational components and design tokens. Data fetching and screen
logic live in `backoffice` or the app. When you need a new edge that goes up a layer, stop: either
the code belongs in the lower package, or you are about to create a cycle. Ask before changing a
layer.

## One codebase, two platforms

Business code is written once and runs on Cloudflare (cloud) and on Rivet/Bun (on-prem).

- **Platform imports (guard).** `cloudflare:*`, `@cloudflare/*`, `rivetkit` and `@rivetkit/*` appear
  only in `packages/adapters/*`, `apps/edge`, `apps/box`, build config, tests and tooling.
- **Shared function, thin shell.** Every Durable Object method, Rivet actor action, Workflow step and
  queue consumer is a few lines that call one shared function in `core`/`api`/`sync`. The reference
  example is `nextStoreSequence()` in `@shopper/core`, which is called by both the `StoreSequencer`
  Durable Object (`packages/adapters/cf/src/coordination.ts`) and `boxSequencer()`
  (`packages/adapters/box/src/sequencer.ts`).
- **Ports only where no library abstracts it.** Hono, Drizzle, unstorage and Better Auth already run on
  both. `@shopper/ports` covers the rest: Sequencer, Lane, Workflow, Queue, Realtime, Scheduler,
  Cache, Blobs, Renderer.
- **A port change updates `packages/conformance` and passes against both adapters.**

## Back office and the public routes

Portal = TanStack Start in SPA mode: a prerendered static shell served by Workers Static Assets; one Worker runs only for `/api/*` (the shared Hono API through native Hyperdrive, D1, R2, Durable Object and Workflow bindings) and `/_serverFn/*` (host-only server functions). Backoffice data stays on the shared API so the box SPA and Electron reuse it.

- `@shopper/backoffice` exports `createBackofficeRoutes(rootRoute)`. The host owns the router, root
  route and query client and mounts these routes: the portal and the desktop register (Electron). The package
  never creates a router or reads a host global.
- From `@shopper/core`, backoffice may import only `@shopper/core/schemas` (Valibot schemas and
  inferred types, no server code).
- `GET /orgs/:slug` (shop code lookup, returns `{ id, name }`) and `GET /orgs/current` (the box's
  fixed org) are public and read-only. `@shopper/api` dispatches `/orgs/*` before the origin and
  tenant checks, so they need no session or tenant header. Keep them GET-only and minimal.

## Pre-shop registration exception

Every customer table carries an `org_id` foreign key to `org`. Registration is the one exception: before
email verification no customer org exists, so `registration_request`, `registration_audit_log` and
`registration_workflow_run`/`_step` store the server-reserved candidate UUIDv7 (`id` = `org_id`), and the
three child tables reference the request instead of `org`. The request holds the proposed owner
name and email; it creates no customer organisation, user or credentials and does not reserve the
shop code. Completion creates the org with that same id in one outer
transaction. Customer tenancy is unchanged.

A command opts into this storage with `defineCommand({ scope: "registration" })`. The scope is part of
the trusted definition, never of the request, so HTTP cannot select it.

The full feature map is in [platforms.md](platforms.md).

## Where code goes

| You are writing...                       | Put it in                                                       |
| ---------------------------------------- | --------------------------------------------------------------- |
| Money or tax arithmetic                  | `@shopper/money`, `@shopper/tax`                                |
| A mutation                               | `defineCommand()` in the owning domain package (`core`, `auth`) |
| An HTTP route                            | `@shopper/api` (Hono), mounted by `apps/edge` and `apps/box`    |
| A contract between processes or packages | A Valibot schema in the producing package                       |
| A back-office screen                     | `@shopper/backoffice` (runs in the portal and in Electron)      |
| A reusable visual component              | `@shopper/ui`                                                   |
| A generic helper with no domain meaning  | See "Shared helpers" in [code-quality.md](code-quality.md)      |
| Anything that touches a platform API     | `packages/adapters/cf` and `packages/adapters/box`, both        |
| A dev script                             | `tooling/`                                                      |

## Till storage and sync push

`@shopper/core/till` owns immutable sale snapshots and audited local recording; core never imports
sync. `@shopper/db-sqlite` owns schemas, and `@shopper/adapters-box/till` owns the Node SQLite
driver and host transports. The driver serializes the whole asynchronous transaction, including
reads, so a concurrent operation cannot enter another command's transaction.

`@shopper/sync` delivers the outbox outside local transactions. Its `./bridge` export contains only
browser-safe Valibot contracts. The till UI subscribes to WebSocket state and sends explicit
actions; credentials and cashier-session proofs stay in the host. Browser connections require an
allowed Origin and a per-start capability kept in memory. The browser capability may edit baskets, take tenders, hold/void and complete sales; private process
IPC additionally retains a recording compatibility helper and shutdown. Both sale entry points use
the same transactional completion writer.

Both HTTP hosts compose `@shopper/api/sync`. An enrolled-device principal establishes upload
scope, independently of browser and expired cashier sessions. Acceptance stores the captured sale
and lines in one audited PostgreSQL transaction; `Sequencer.assignSale` assigns its store sequence
in another. Both adapters call the shared assignment command. Replays recover persisted results
without another mutation or audit, and acknowledgment waits for sequence assignment.

Protocol negotiation and event decoding are separate contracts. Day 11 reset disposable till data and
Day 14 did it again for price overrides: only sync protocol 4 and sale event v4 are accepted, with no
upcaster, and older tills must update and re-bootstrap.
The sale carries tender amounts, inclusive discounts, authoritative label provenance, signed cash
rounding and receipt identity. Its original application version stays intact. The server validates
and stores corrected occurrence time, capped at acceptance, alongside raw device time. Each side
builds a versioned receipt document; receipt JSON stays out of the synced event. Completion writes
sale lines, tenders, signed stock movements and its audit atomically in each database.

Reference mutations append store-scoped changes in their audited PostgreSQL transaction.
Authenticated tills bootstrap from a versioned gzip snapshot through the Blobs port, then apply
ordered pages and the cursor in one audited SQLite transaction. Snapshot reads use the same
projections as the feed in a REPEATABLE READ transaction. Realtime carries sequence nudges;
PostgreSQL remains the source for all downloaded data. A missed nudge is recovered by reconnect
or the capped transport fallback. The host owns push, pull, realtime and receipt state; the UI
subscribes to their combined status without receiving device credentials.

### Refunds and manager approvals (Day 14)

Refunds are their own records (`refund`, `refund_line`), never negative sales, so sale rules and
reports stay unchanged. Each refund line's tax is a share of the original line's snapshot from
`refundShare` in `@shopper/tax`: a cumulative difference of `mulRatio`, so partial refunds never go
negative and always sum to the sold line. Today's `tax_rule` is never read. The server recomputes
every share and rejects any mismatch, any final-sale line and anything over the quantity sold, under
`FOR UPDATE` on the original sale. A cash payout may carry at most 5 pesewas of signed rounding.

A till refunds its own sales offline. The refund is uploaded to `POST /sync/refunds` through the
shared document upload lane (`@shopper/sync/uploads/documents`), and only after the sale backlog
drains. Sales from other registers are found with `GET /sync/sales/lookup` and refunded online: the
host waits for the server to accept before it records the refund, prints and opens the drawer. A
stable refund id makes a retry after a lost reply replay instead of refunding twice.

Manager approvals are one mechanism for refunds, price overrides and voids after tender.
`GET /sync/approvers` sends members holding `refund.approve`, `sale.void` or `sale.price_override`,
with their Better Auth PIN hash, to the till (`till_approver`). The host checks the PIN offline: five
failures lock the manager for 15 minutes, a list older than 7 days approves nothing, and guesses for
one manager run one at a time. Only a verified approver id reaches a core command, and `till_audit`
and `audit_log` record both actor and approver. The server re-checks the approver's current grant in
`role_permission`, but it cannot prove a PIN was typed. The return window and `requirePinForReturns`
live in register settings and are enforced on the till only.

Price overrides travel on sale event v4 lines as `override {listPrice, reason, approverId}`. Receipt
documents are v2 (`kind`, `refundOf`), and stored v1 receipts are upcast on read.

### Shifts and cash control (Day 15)

A shift belongs to one register (drawer): `shift_current` lets one shift per device be unfinished.
Sales, tenders, MoMo starts, refunds, drops and no-sales need an open shift (`SHIFT_REQUIRED`), and a
counted one refuses them (`SHIFT_COUNTED`). Sales and refunds join their shift by a till-only
`shift_id` stamped in the `sale.complete` and `refund.record` transactions, so the sale and refund
events are unchanged. A cashier change mid-shift needs no new record.

The cash arithmetic is one pure function, `shiftTotals` in `packages/core/src/shifts/totals.ts`,
shared by the X and the Z: cash kept from a sale is its cash tenders less change (rounding is inside
the change); a cash refund pays out its total; expected cash is float + cash kept − cash refunds −
drops; card and MoMo expect their tenders less their refunds. A no-sale moves nothing.

The close is blind: `shift.declare` stores the count (by denomination) and the card and MoMo terminal
totals, is final, and fixes the variance threshold (`varianceThreshold`, a register setting, default
GHS 5). Any `|variance|` strictly over it needs a manager PIN for `shift.approve` (the Day 14
mechanism; the permission syncs to tills). The X needs `report.read`, so a cashier never sees the
expected cash before counting. A declared shift over the threshold waits for a manager; nothing else
can move it. The Z is stored on the shift and reprinted, never recomputed.

The Z carries the audit anchor: the `till_audit` chain head (`chain_seq`, `hash`, or `GENESIS_HASH`)
read inside the close transaction before the close's own row. It is printed and uploaded. Each closed shift uploads once as a `shift.closed` v1 event to `POST /sync/shifts`
on the document lane, after the sale backlog drains. The server (`shift.accept`) re-checks the Z's own
arithmetic (`SHIFT_MISMATCH`), the closing session's `shift.write` and the approver's live
`shift.approve`, then stores `shift`, `shift_tender` and `shift_movement`. The back office reads `GET /shifts` and `GET /shifts/:id`
behind `shift.read`; open shifts stay on the till.

Each read also checks the Z (Day 20), at read time so a late upload corrects itself: the register's own
completed sales and refunds between the shift's open and close (device clock, as the Z) summed by the till's
`shiftTotals`, against the Z's sales, tax, refunds, account and per-tender figures (`matched`, or `mismatch`
naming the fields); and the uploaded register chain at the Z's anchor seq (`verified`, `pending` until the
chain uploads, or `mismatch`). The till uploads its `till_audit` chain to `POST /sync/audit` before its
shifts, so a Z's anchor is normally on the server when the Z arrives (see `packages/audit/README.md`).

### Inventory (Day 16)

Stock on hand is never stored. It is the fold of the signed `stock_movement` ledger
(`onHand`/`onHandOf` in `packages/core/src/stock/onhand.ts` are the only readers), per branch, and a
reorder point and every report read the same fold. Every writer runs inside its own `defineCommand`:
sales and refunds (from the till), till counts and receipts (sync upload), and the portal's goods
received (`stock.receipt.record`, supplier required, unit cost per base unit on the movement as
`unit_cost`), adjustments (`stock.adjustment.record`, with a cause: damaged, expired and theft
remove, found adds, other picks a direction; wastage is damaged or expired) and stock takes. Portal
records reuse `stock_document` with no device; the client sends a UUIDv7 id so a retried submit
replays (same id and content) instead of doubling stock.

A stock take (`stock_take`, one open per branch) snapshots every active product, or one category.
Counts stamp `counted_at`; the post (`stock.take.post`) refuses while a line is uncounted
(`NOT_COUNTED`) and writes `count` movements of counted − on hand at each line's `counted_at`, the same
rule and `SUPERSEDED` check as a till count (`countDeltas`). Sales continue during a take. Valuation is
on hand × the last received unit cost for that product and branch; receipt line totals round to the
pesewa (`lineTotal`). Every route sits under `/stock` behind `stock.read` (reads, valuation) and
`stock.write` (writes, suppliers); a till principal is forced to its own branch.

Low stock: `reorder_point` is per product per branch. `checkReorder`, called by every writer in the
same transaction, raises a `stock_alert` when on hand ≤ the level and clears it when on hand rises
above it; the partial unique index `stock_alert_open` makes one alert per crossing. The raise queues
a `stock.low` v1 envelope through `enqueueAfterCommit`, which `defineCommand` sends only after the
transaction commits (a rolled-back write sends nothing; a failed send is logged). The consumer
(`deliverStockAlert`) texts the branch's `alert_phones` (up to 3) through Arkesel and marks
`sent_at` with an audited `stock.alert.sent`; a cleared or already-sent alert, or a branch with no
phones, is acked without a text. A send lost after commit, or an alert raised before phones were set,
stays unsent until the watchdog re-send exists.

## Assets and organization management

`@shopper/assets` owns publicity/access policy, purpose and bucket selection, audited asset tracking and authorized presigned grants. Provider operations use Blobs; credentials stay in adapters. The API receives metadata and asset references, never client file bytes. Before processing, resolve the tenant-owned asset and verify bounded actual bytes against its registered digest and size. A presigned URL remains a bearer capability until expiry, so repeat verification before every use.

The cloud portal, local box SPA and Electron share `@shopper/backoffice`. On-prem stores, branches, products and staff are authoritative in box PostgreSQL and available over LAN without WAN. Subscription/payment/cloud-storage/backup provisioning and cloud account setup belong to a separate cloud control plane. Local installation settings remain local. Optional cloud sync requires explicit scoped/versioned ownership contracts; two databases never become concurrent writers by implication. Desktop disconnection from its authority does not grant unrestricted offline mutations.

### Desktop register (Day 13)

The Electron app forks the till host and loads the till UI from it (`http://127.0.0.1:<port>/`); there
is no preload. Staff sign in with email and password through the host, which calls
`POST /cashiers/login` with the device token. Offline, a scrypt verifier cached on the till (7 days,
5 failures then 15 minutes) resumes the user's unexpired session or grants only `report.read`,
`stock.read` and `stock.write`. Revocation is not seen offline inside that window.

Back office on the desktop: the host answers `/api/register/*` (this register's report and the stock
queue) and the auth/session endpoints locally, and proxies the rest of `/api/*` upstream as the device
principal. The proxy needs the per-start `shopper_desktop` cookie from `POST /desktop/unlock`, a loopback
Host and a same-origin Origin on writes; it canonicalises the path, keeps the upstream origin, never
forwards `/auth`, `/sync` or `/cashiers`, and strips cookies and CORS headers. Stock counts and receiving
are queued in till SQLite and uploaded to `POST /sync/stock` only after the sale backlog drains.

### Customers on the till (Day 17)

Customers reach tills as `customer` rows of the change feed and snapshot (both v4; v3 upcasts, a v3 snapshot has no
customers) and land in `customer_lookup`: name, phone, kind, business name, TIN and the version read. The limit, the
ledgers and the email never leave the server. Archived and merged customers drop out of the lookup. Quick-create and
edit work offline: the lookup changes at once and a `customer.created` or `customer.updated` v1 event is queued in
`customer_upload`, uploaded to `POST /sync/customers` on the document lane after the sale backlog drains. The server
audits `customer.till.create` / `customer.till.update` (the session needs `customer.write`). An update that names the
version the server holds applies whole; otherwise each field takes the later writer by the time the cashier acted,
read from the audit history after that version, and both versions go in the audit. A conflict is never a rejection,
so it never blocks the queue. The reply carries the customer as it now stands, which replaces the lookup row; a
snapshot rebuild and every pull put the edits still waiting back on top.

### Credit, loyalty and statements (Day 17)

A customer's account is two append-only ledgers, `credit_entry` and `loyalty_entry`. Triggers reject any update or
delete, and there is no balance column anywhere: every balance, statement and ageing bucket is a fold (`SUM`, or a
running `SUM() OVER` for a statement). A positive credit balance means the customer owes; below zero is a
**deposit**, which can be spent on account even with no limit. A limit above 0 needs the customer to be
KYC-verified. Available credit is `limit - balance - held`.

- **Holds.** Credit and points are online only. The till takes an `account_hold` (id = the till tender id) under
  `FOR UPDATE` on the customer before the sale completes. It counts for one hour (expiry is a predicate in the
  fold), is released by removing the tender or voiding, and a basket holding one cannot be parked. `acceptSale`
  consumes the hold into a `charge` or `redeem` entry and refuses an account tender only when its hold is missing,
  which means a forged sale. A rejected sale would block the push queue, so nothing else is refused.
- **Account payments** at the drawer are an `account.payment` v1 document (till `account_payment`), uploaded on its
  own lane after the sales and the customer upload, to `POST /sync/accounts/payments`. They only lower what is
  owed, so they work offline. The ledger entry links the shift only once the server has its Z; the audit row always
  names it.
- **Refunds** go to the account first (a credit note, up to what the sale charged), then back as points, then to
  the original tenders. The refund event states the split (`accountCredit`, `pointsReturned`, `pointsValue`) and the
  server checks it against its own working. The earn is reversed at the rate and point value its entry stored.
- **Loyalty** is per org and off by default. Earn is `floor((total - points tendered) * rate / point value)`, at
  the tier rate (trailing 365-day spend, worked out at earn time, never stored). Expiry is FIFO by earn lot as
  `expire` entries. A points transfer writes a pair of `transfer` entries in one command.
- **Merge** writes `transfer` entries out of the loser and into the winner on both ledgers, sets `merged_into_id`
  and `archived_at` on the loser, and releases its holds and open KYC cases. Sales keep their id; `acceptSale`
  follows a merged id to its winner (bounded, never throws). Archive is refused while the balance, points or a hold
  is open.
- **Time-based posting** (interest, points expiry, tier downgrade notices) is the `customer-account` Workflow, one
  instance per customer (id = customer id). `nextDue(customer)` is pure; the flow sleeps to it, posts idempotently
  (interest is unique per customer and period, and a missed period is caught up), and ends when nothing is due.
  Earn, charge, settings, merge and archive start or wake it. No cron, no polling.
- **Statements.** `statement.send` writes a `statement_delivery` row (unique on customer, period, channel) and
  enqueues it. The notifications consumer renders the PDF through the Renderer port and sends it through Maileroo
  (PDF attached) or Arkesel (a summary). `statement.link` signs `{linkId, orgId, customerId, from, to, exp}` with
  the link secret (30 days, revocable). The public page reads it with no session, counts views on the link row, and
  answers a bad, expired or revoked token with 404 and no detail. The `statement-schedule` Workflow (instance id =
  org id) sleeps to the next run day in Accra and fans out one message per customer.
- **KYC** lives in `@shopper/auth/kyc` because it changes roles: phone OTP, an optional manual ID check, manager
  approval. An ID number is stored only masked plus an HMAC fingerprint and never reaches an event, step, log or
  audit row.

**Versions bumped in Day 17:** sale event v5 (carries the customer; v4 upcasts with none), change feed and snapshot
v4 (v3 upcasts), receipt v3 (a `buyer` block and the credit and loyalty tender kinds; v2 upcasts), refund v2 (the
account and points split) and shift Z v2 (on-account sales, account payments, refunds credited, points redeemed).
New at v1: `customer.created`, `customer.updated`, `account.payment` and the queue messages `statement.send`,
`statement.schedule` and `statement.scheduled`. `KNOWN_VERSION` on the pull side is 4.

## Tax (Day 18)

- **Settings** live on `org`: `tin`, `vat_registered_from` (null means not registered), `price_mode`
  (`inclusive` by default, or `exclusive`) and `cash_rounding`. `tax.read` reads them and `tax.write` (super admin)
  changes them. A change goes to every store as one `org-setting` feed row, keyed by the org id, which the till keeps
  as its settings row. A shop that never gave a registration date counts as registered since `registeredSince`
  (2000-01-01, `@shopper/tax`).
- **The engine** quotes in the org's price mode. Every line's tax snapshot records `registered`: before the
  registration date, or with none, every rate is zero. The server accepts either price mode when the arithmetic
  holds (a till may quote before a mode change reaches it), but the line's `registered` must match the org on the
  sale date. Price labels are the customer's gross, so they are always inclusive. A discount comes off the price
  before tax in both modes.
- **Dated rules.** `GET /tax/rules` lists them; `POST`, `PATCH` and `DELETE /tax/rules[/:id]` need `tax.write`. A
  rule starts after today in Accra and can change only until it starts, so no sale already made falls under a new
  rate. Each change is audited and sent to every store. `GET /tax-rules?on=` stays as the published lookup.
- **Credit notes.** A refund takes its own number from the register's receipt block. For a refund the server must
  accept first, the host reserves the number (`refund.credit_note.reserve`, audited) before it posts, so the posted
  and recorded events match; an offline refund takes it when it is recorded. The server checks the number belongs to
  the uploading register (`validateReceipt`) and keeps it unique per org. The fiscal payload says `invoice` or
  `credit_note` and names the original invoice.
- **Reports** fold the stored snapshots in PostgreSQL (`core/tax/reports/fold.ts`): a sale line on its tax date, a
  credit-note line on the Accra day it was made. `GET /tax/summary` groups by day or month, branch and class.
  `GET /tax/returns/:period` is the month's worksheet (lines a shop sold while not registered are left out);
  `PUT .../input` records the input tax claimed (`tax.return`, granted to accountants); `.../export.xlsx` is the
  workbook (SheetJS) with the return, sales by class and the credit notes. The shared runtime routes `/tax/*`
  behind the session.

**Versions bumped in Day 18:** sale event v6 (each line's tax has `registered`; v5 upcasts as registered), refund
v3 (`creditNoteNumber`, and `registered` on its lines; v2 upcasts with none), change feed and snapshot v5 (the
`org-setting` entity; a v4 snapshot's rounding becomes the settings) and receipt v4 (`header.vatInvoice` and each
line's `net`; v3 upcasts as a registered shop's, with no nets). `KNOWN_VERSION` on the pull side is 5.

## GRA E-VAT fiscalisation (Day 19)

Fiscalisation never blocks a sale. The till prints at once; the server sends the document afterwards, in order.

- **Documents.** When `sale.accept` or `refund.accept` stores a receipt that is a VAT invoice (`header.vatInvoice`)
  with a number, it inserts a `fiscal_doc` in the same transaction: `kind` invoice or credit note, the
  `fiscalPayload` of the receipt, `status` `pending`. A shop that is not VAT-registered makes none. Statuses:
  `pending → submitted → accepted | rejected`, or `dead` after the tenth failed try.
- **SDC port.** `Sdc.submit({ invoiceNumber, payload })` answers a signature (`sdcId`, `counter`, `signature`,
  `qr`, `signedAt`) or a final rejection (`code`, `message`); an unreachable SDC or a 5xx throws `SdcUnavailable`.
  `createSdc` (`@shopper/core/fiscal`) is plain `fetch`, built against the mock contract in `tooling/sdc/server.ts`
  until GRA sandbox access is granted. A resubmission of one invoice number gets its first answer.
- **Submission** (`submitFiscalDoc`) is two audited commands around the call: `fiscal.submit` (claim, count the try)
  and `fiscal.settle` (signature, rejection, or back to pending with the error; dead on the tenth). An accepted
  document writes a `fiscal-doc` feed change to its store and starts the archive bundle of its hour.
- **FiscalLane** (`Lane` port, one per store, keyed `orgId/storeId`). The sync routes enqueue a document after the
  upload commits (a replayed upload enqueues it again). The queue is FIFO; the head is retried with backoff (30 s
  doubling, at most an hour) before anything behind it, so a store's documents reach the SDC in receipt order. After
  ten failures the head is dead-lettered and the lane moves on; the dashboard's Retry (`tax.write`) puts it back at
  the end. When a lane drains it adopts its store's stranded documents (an enqueue lost after the commit) that are
  over a minute old, and looks again a minute later if younger ones exist. An idle lane has no timer, so every till
  pull (at least every five minutes) hands the store's oldest stranded document to the lane (`sweepStrandedFiscal`);
  re-enqueueing a queued document is a no-op that keeps a failing head's backoff. No cron. Cloud: the `FiscalLane` Durable Object
  (queue in its SQLite, an alarm drains it, a drain mutex keeps a forced alarm from racing a real one). Box: the
  in-process `boxLane`, rebuilt from PostgreSQL by `relaunch` at boot (Rivet actors replace it on Day 36). Both pass
  `laneConformance`. Without `SHOPPER_SDC_URL` and `SHOPPER_SDC_KEY` no lane is wired and documents wait as pending.
- **Receipts.** Receipt v5 adds `fiscal` (null until signed). A VAT invoice prints at once as PROVISIONAL with no QR;
  a signed one prints the SDC's QR and `E-VAT <sdcId> #<counter>`; a plain receipt prints neither. The till applies
  the `fiscal-doc` change to the receipt it holds (`signLocalReceipt`), so a reprint is the definitive receipt, and
  marks a rendered PDF stale. A till that catches up through a snapshot skips those feed rows, so before applying it
  the till posts its provisional receipts to `POST /sync/snapshot/signatures` (pages of 500) and applies the
  signatures in the snapshot's transaction; a failed request applies nothing. After the pull the host renders the definitive PDF and uploads it again. The server
  replaces the bytes under the same receipt asset: `asset.verified_sha256` records which bytes were checked, so the
  same PDF stays final and another digest supersedes it.
- **Archive.** `FiscalArchiveWorkflow` (instance `fiscal-archive_<orgId>_<storeId>_<YYYYMMDDHH>`) sleeps until five
  minutes after its hour, then bundles every accepted, unarchived document of the store accepted before the hour
  ended as JSONL at `fiscal/<storeId>/<yyyy>/<mm>/<dd>/<hh>.jsonl` in the org's blobs, and records `fiscal_archive`
  (count, bytes, SHA-256) and each document's `archive_id` in one transaction. A document a bundle missed lands in
  the next. Six-year retention is the bucket's lifecycle rule on `fiscal/`.
- **Dashboard.** `GET /tax/fiscal` (counts per segment, newest 200, search by number), `GET /tax/fiscal/:id`,
  `GET /tax/fiscal/archives?date=` (signed download links) need `tax.read`; `POST /tax/fiscal/:id/retry` needs
  `tax.write`. The reply says whether an SDC lane is connected.

**Versions bumped in Day 19:** receipt v5 (`fiscal`; v4 upcasts unsigned), change feed and snapshot v6 (the
`fiscal-doc` entity; the snapshot is unchanged). `KNOWN_VERSION` on the pull side is 6.

## Access (Day 21)

Permissions are data (`role_permission`), and so is **branch scope** (`member_branch`): a member with
rows works only at those branches, and one with none works everywhere. The owner is always org-wide.
Deactivation is `member.deactivated_at`. Both live in `@shopper/auth`; its README has the rules.

- **One scope helper.** `branchScope(principal)` in `api/src/middleware/require/branches.ts` returns a
  till's own branch, a scoped member's branches, or `undefined` for every branch. `assertBranch`,
  `scopedBody` and `scopedQuery` answer 403 for a branch outside it, and `requireOrgWide` guards the
  org-wide views (the VAT return, chain verification). Branch-keyed core reads take `scope?: string[]`
  and filter with `inArray`: stock, shifts, devices, audit, tax reports and fiscal, and the branch and
  store lists. A row outside the scope reads as 404. Store and branch writes are refused to any scoped
  member (403), whatever their role holds. Catalogue, customers, tax rules, roles and users stay
  org-wide behind their permissions. New branch-keyed reads (Day 22 sales and refund reports
  included) must take the scope too.
- **Tills follow at their next approvers refresh.** `GET /sync/approvers` carries `staff`, the active
  members allowed at the register's branch, and the till deletes any cached sign-in not in it. The till
  and server ship together, because an older till rejects the new response.
- **Cut, not revoked.** Deactivating or rescoping a member cuts their live cashier sessions to now, so
  sales made before the cut still upload with their historical authority.

The owner approved this architecture on 14 October 2026. This cleanup documents it; it does not implement new management hosts, billing, backup services or Electron. TanStack Start remains the customer-shop SSR framework; management keeps the existing Router SPA.
