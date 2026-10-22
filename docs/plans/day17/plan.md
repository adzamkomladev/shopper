# Day 17 · Customers, credit and loyalty: plan (rev. 2, 22 Oct)

## Context

**Notion row:** Day 17 · Customers & loyalty (API, Portal, Till).

**Goal:** a regular customer is recognised at the till by phone number.

**Tasks on the card**

- KYC workflow.
- Till lookup by phone, and quick-create.
- Append-only loyalty ledger.
- Credit accounts with limits, and statements.
- Buyer TIN and business name on B2B VAT invoices.
- Portal customer screens and a customer CSV export.

**Required tests**

- "Credit sale over limit refused"
- "Loyalty balance equals ledger fold"
- "B2B sale carries buyer TIN onto the invoice and fiscal payload"
- The done-when becomes an e2e.

**Added by the owner on 22 Oct**

| Area                   | Additions                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| KYC                    | ID documents (Ghana Card, passport, voter ID, driver's licence) are **optional by default**. An admin setting makes them required. |
| Customers              | Merge duplicates, archive, edit on the till.                                                                                       |
| Statements             | Sent by SMS or email, and as a PDF.                                                                                                |
| Credit                 | Credit notes, deposits, payments on account at the till drawer, interest, ageing.                                                  |
| Loyalty                | Points expiry and tiers.                                                                                                           |
| Reports                | On-account and points lines on the X/Z report.                                                                                     |
| Statements (2nd round) | Customer-facing statement links; statements on a schedule.                                                                         |
| Loyalty (2nd round)    | Points transfers between customers; tier downgrade notices.                                                                        |
| KYC (2nd round)        | Ghana Card verification is **manual** for now. There is no identity provider and no stub.                                          |

This is well over one 8-hour day. The schedule slip goes in the Notion remarks.

**Base branch.** Local `main` was pulled to `67f858d`, the toolchain upgrade (#29). Day 16 (PR #27) is not in main yet. So:

1. `git switch -c day17-customers main`
2. `git merge origin/day16-inventory`, resolving toolchain conflicts. This is the first commit.

The PR targets `main`. The diff narrows once #27 merges.

### Owner decisions

1. Customers are pulled to the till. Lookup, quick-create and **edit** work offline and are pushed through the outbox.
2. Credit and points redemption are online only. Account payments at the drawer work offline, because they can only lower what is owed.
3. Loyalty is set per org and off by default. That covers earn rate, point value, expiry and tiers.
4. KYC:
   - Phone OTP and manager approval are always needed.
   - The ID step is optional unless the org turns on "ID required".
   - Every ID type, Ghana Card included, is verified **by hand**: the approver sees the type and masked number and ticks "ID document sighted". There is no provider call.
   - The OTP goes by Arkesel.
5. Data is disposable. Figma is read-only. Codex is out, so the `reviewer` agent reviews.

### Constraints found in the code

**A rejected sale blocks the till's push queue** (`packages/sync/src/push/worker.ts:145`). So:

- Credit and points use a **server hold**, created online before the sale completes.
- `acceptSale` consumes the hold. It refuses an account tender only when there is no hold, which means the sale was forged.

**The till document lane uploads after sales.** So the v5 sale carries the customer snapshot inline, and `acceptSale` upserts the customer.

**Package layering.** `@shopper/auth` imports `@shopper/core`, and KYC changes roles. So KYC lives in `@shopper/auth`.

**Snapshot apply deletes every reference row** (`packages/sync/src/pull/snapshot.ts:24`). Pending till customers are re-projected after it.

**Files at the size limit.** Extract code from these first:

| File                                                | Lines |
| --------------------------------------------------- | ----- |
| `apps/till/ui/src/screens/sale/screen.tsx`          | 295   |
| `apps/till/ui/src/sale/store.ts`                    | 246   |
| `apps/till/ui/src/components/sale/tender/panel.tsx` | 259   |
| `packages/core/src/till/complete.ts`                | 231   |

**Existing pieces to reuse**

- PDF: `packages/hardware/src/render/pdf.ts` (`pngPdf`) plus the Renderer port (`packages/conformance/src/cases/renderer.ts`, box `packages/adapters/box/src/renderer.ts`).
- Email: `createMaileroo` (`@shopper/auth`).
- SMS: `createArkesel`.
- The notifications Queue port from Day 16.
- Shift totals and X/Z: `packages/core/src/till/shifts/report.ts`, `packages/hardware/src/escpos/shift.ts`, `packages/backoffice/src/components/shifts/report/*`.

**The register report CSV** (`registerReportCsv`) lacks a formula-injection guard and formats quantities with a float.

### Defaults taken (override at approval)

**Balance and deposits.** A positive `balance` means the customer owes money. Below zero is a **deposit**.

- Available credit = `limit − balance − held`.
- A customer with no limit can still spend a deposit on account. KYC is only needed for a limit above 0.

**Holds.** A hold's id is the till tender id. It is created under `FOR UPDATE` on the customer and counts for 1 hour. Expiry is a predicate in the fold.

- Removing the tender or voiding the basket releases it.
- A basket holding an account tender can't be parked.

**Refunds.** A refund goes back to the account first, as a credit note, up to the amount the sale charged to it. Then points are re-credited, then the original tenders as today. This replaces the earlier `ACCOUNT_REFUND` refusal.

- The refund event states the split it was paid in (`accountCredit`, `pointsReturned`, `pointsValue`), and the server checks it against its own working.
- Points are re-credited as whole points, up to the points the sale redeemed less those already returned.
- The earn is reversed at the rate and point value its entry stored, capped at the unreversed points.

**Credit notes.** A portal credit note is a negative `credit_entry` with a reason. It needs `customer.manage`.

**Interest.** Org settings `credit_terms_days` (default 30) and `credit_interest_bps` per month (default 0, meaning off).

- On the 1st of each Accra month, interest is charged on the balance aged past terms.
- One entry per customer per period, enforced by a unique key.

**Ageing.** A pure function allocates payments and credit notes FIFO against charges. Buckets: current, 1–30, 31–60, 61–90 and 90+ days past terms. Nothing is stored.

**Points expiry.** Org setting `loyalty_expiry_days`, where 0 means never.

- Points expire FIFO by earn lot as `expire` entries.
- The balance is always the ledger fold.

**Tiers.** A `loyalty_tier` table holds a name, a minimum spend over the trailing 365 days, and an earn rate in bps.

- The tier is computed at earn time from the sale fold and is never stored.
- Each earn entry stores the rate it used.

**Time-based posting (interest and expiry).** One `customer-account` Workflow per customer, with instance id = customer id.

- It waits until the next due moment (next interest date or next lot expiry), posts the entries idempotently, and repeats.
- It ends when nothing is due. Earn, charge, settings, merge and archive start it or wake it.
- A settings change fans out through the Queue port to the customers it affects.
- No cron and no polling.
- The box runs it on `memoryWorkflow`. On boot it relaunches accounts with anything due (`ponytail:` note: Rivet takes over on Day 36).

**Merge.** `customer.merge(winner, loser)` writes `transfer` entries out of the loser and into the winner on both ledgers.

- The loser gets `merged_into_id` and `archived_at`.
- Sales keep their original id. Customer sales queries include merged ids.
- `acceptSale` maps a merged id to its winner.
- The loser's open holds and open KYC cases are released or closed.

**Archive.** Refused while the balance or points are not zero, or while holds are open. Archived customers leave the till lookup. They can be unarchived.

**Edit on the till.** `till.customer.update` writes a `customer.updated` v1 event covering name, phone, kind, business name and TIN. The limit can't be edited there.

- The server applies it when the event's base version equals the current version. Otherwise it applies fields last-writer-wins by `occurred_at`, and audits both versions. This is never a reject that blocks the queue.

**Account payments at the drawer.** `till.account.payment` in cash or MoMo (MoMo needs the network) writes an `account.payment` v1 document.

- It prints a payment receipt (a slip; cash opens the drawer).
- `shiftTotals` adds cash account payments to expected cash.
- X/Z gets "Account payments" lines.
- The payment is a till `account_payment` row (SQLite step 11) uploaded by its own document lane to `POST /sync/accounts/payments`, after the sales and after the customer's own upload. The server runs `customer.payment` with the method and shift.
- The shift's Z arrives only when it closes, so the ledger entry links the shift only if the server already has it; the audit row always names it.
- MoMo needs the network and records the confirmed MoMo reference; the prompt-to-pay flow is not wired to account payments.

**X/Z lines:** On-account sales, Points redeemed (points and GH₵), Account payments by method, and the refunds credited to accounts.

**Statements**

- **PDF:** a `StatementView` component (Satori-safe flexbox), turned into a PDF through the Renderer port.
- **Email:** Maileroo, with the PDF attached.
- **SMS:** a summary through Arkesel, e.g. "Owed GH₵ 120.00, last payment GH₵ 50.00 on 3 Oct".
- Each send is a `statement.send` command that writes a `statement_delivery` row. A notification queue message then delivers it, once, and is audited.

**KYC ID**

- Accepted types: `ghana_card`, `passport`, `voter_id`, `drivers_licence`, each with its own format regex.
- Org settings: `kyc_id_required` (default false) and `kyc_id_types`.
- Verification is manual for every type. The number is stored only masked plus an HMAC fingerprint, which drives a duplicate-ID warning.
- When an ID was given, approving requires `idSighted: true`, which is recorded on the case.
- An ID number is never stored in clear and never appears in events, steps, logs or audit.
- A provider can be added later as one adapter file, called from `kyc.id.record`.

**Customer statement links**

- `statement.link` creates a `statement_link` row and a signed token: HMAC over `{linkId, orgId, customerId, from, to, exp}`, using the shared `hmacHex` from `links/tokens.ts`.
- A link expires after 30 days and can be revoked.
- The public page `/statement/$token` on the portal (no sign-in) shows `StatementView` with a PDF download. Its API is `GET /public/statements/:token` and `/pdf`.
- A bad, expired or revoked token gets 404 with no detail.
- Every view writes `viewed_at` and `view_count`. That is not an audit command; it is a counter on the link row.
- SMS and email statements carry the link.

**Statements on a schedule**

- Org settings: `statement_schedule` (off by default, or monthly), `statement_day` (1–28), `statement_channels` (sms, email) and `statement_min_balance`.
- One `statement-schedule` Workflow per org, with instance id = org id.
  - It waits until the next run date (Accra) using `waitFor("wake", timeout)` as an interruptible sleep.
  - Then it runs a step that fans out through the Queue port, one message per customer whose balance is at least the minimum or who had activity in the period.
  - Then it loops.
- A settings change wakes it. Turning the schedule off ends it.
- Idempotent: `statement_delivery` is unique on `(customer, period, channel)`.

**Points transfers**

- `loyalty.transfer(from, to, points, reason)` needs `customer.manage`. It writes a pair of `transfer` entries in one command.
- It is refused for points short (held points count), the same customer, an archived customer, or loyalty being off.

**Tier downgrade notices**

- `tierProjection(customer, asOf)` is pure. Assuming no new sales, it finds the date when trailing 365-day spend drops below the current tier's minimum.
- Org setting `tier_notice_days` (default 14, 0 = off).
- The account workflow's `nextDue` includes `downgradeDate − noticeDays`.
  - On wake it re-projects, because new sales may have kept the tier.
  - If the downgrade still stands, it sends one SMS, or email when there is one: "Your Gold tier changes to Silver on 12 Nov".
- A `tier_notice` row, unique on `(customer, from_tier, effective_on)`, ensures it is sent once.
- The portal shows "Moves to Silver on 12 Nov" on the customer.

**Other defaults**

- Phone is not unique. Lookup lists every match, and merge fixes duplicates.
- TIN format: `^(?:[A-Z]\d{10}|GHA-\d{9}-\d)$`.
- B2B buyer = `{name: businessName ?? name, tin}`.
- `toCsv` lives in `@shopper/utils` and guards cells starting with `= + - @`, tab or CR.

## Data model: migration `0025_customers`

Hand-written, idempotent SQL with `--> statement-breakpoint`, plus a `_journal.json` entry (idx 25). Drizzle schemas live in `packages/db/pg/src/schemas/customers/{base,holds,ledgers,kyc,loyalty,statements,index}.ts`. Every table uses `tenant()`, a UUIDv7 id, `org_id`, and composite `(org_id, x_id)` foreign keys.

### Tables

**`customer`**

- Columns: name; phone `0XXXXXXXXX`; kind (individual or business); business_name; tin; email; credit_limit money; kyc_verified_at; version int; archived_at; merged_into_id; created_device_id.
- Indexes on `(org, phone)` and `(org, lower(name))`.
- Checks:
  - A business has a business name.
  - The TIN matches the format.
  - The limit is 0 or more.
  - The limit is 0 unless the customer is KYC-verified.
  - A merged customer is archived.

**`account_hold`**

- Columns: id = till tender id; customer_id; kind (credit or loyalty); amount; points; point_value; branch, device and cashier ids; status (held, consumed or released); sale_id; created_at.

**`credit_entry`** (append-only)

- `kind` is one of charge, payment, credit_note, interest or transfer.
- `amount`: charges and interest are positive; payments and credit notes are negative; transfers can be either.
- Other columns: sale_id, refund_id, hold_id (unique), method (cash, MoMo or card), shift_id, reason, period (interest only, unique per customer), actor_id, occurred_at.

**`loyalty_entry`** (append-only)

- `reason` is one of earn, redeem, reverse, expire or transfer, with points ≠ 0.
- Other columns: sale_id, refund_id, hold_id (unique), rate_bps and point_value (on earn), lot_id (on expire, pointing at the earn entry).
- Unique keys: one earn per sale; one expire per lot.

**`loyalty_tier`**

- Columns: name, min_spend money, earn_bps, archived_at.

**`statement_delivery`**

- Columns: customer_id, channel (sms, email or pdf), period from/to, status (queued, sent or failed), provider_reference, actor_id.

**`statement_link`**

- Columns: customer_id, period from/to, expires_at, revoked_at, viewed_at, view_count, created_by.

`statement_delivery` also gains `link_id`, plus a unique key on `(customer, period, channel)`.

**`tier_notice`**

- Columns: customer_id, from_tier_id, to_tier_id (null means no tier), effective_on, sent_at, channel.
- Unique on `(customer, from_tier_id, effective_on)`.

**`kyc_case`**

- Subject: customer or member, with exactly one of the two ids.
- Request: purpose (credit or role), requested limit or role, phone.
- `status` is one of otp_sent, id_needed, review, approved, rejected or expired.
- OTP fields: otp_digest, otp_expires_at, otp_attempts, otp_sends.
- ID fields: id_type, id_fingerprint, id_masked, full_name, id_sighted.
- Decision: opened_by, decided_by, decided_at, decision_note, approved limit or role, decision_due_at.
- Only one open case per subject.

**Both ledgers** get `BEFORE UPDATE OR DELETE` triggers using `shopper_reject_history_change()` from 0010. No balance column exists anywhere.

### Changes to existing tables

**`org`** gains:

- loyalty: `loyalty_enabled`, `loyalty_earn_bps`, `loyalty_point_value`, `loyalty_expiry_days`, `tier_notice_days`
- credit: `credit_terms_days`, `credit_interest_bps`
- statements: `statement_schedule`, `statement_day`, `statement_channels`, `statement_min_balance`
- KYC: `kyc_id_required`, `kyc_id_types`

Each group has a consistency check.

**`sale`** gains `customer_id`, as a foreign key with an index.

**`sale_tender`** kinds now include credit and loyalty. It gains a unique `hold_id`, required exactly when the kind is credit or loyalty. TypeScript gets a separate `saleTenderKinds`; the existing `tenderKinds` stays as it is for shifts and refunds.

**`refund`** records `account_credit` and `points_returned`.

**`store_change`** entity check gains `customer`.

### Permissions

The total goes from 32 to 36. Existing orgs get the new rows in the migration, following 0008.

| Code              | Covers                                                                                       | Owner | Admin | Accountant | Cashier | Inventory |
| ----------------- | -------------------------------------------------------------------------------------------- | ----- | ----- | ---------- | ------- | --------- |
| `customer.read`   | Viewing customers                                                                            | ✓     | ✓     | ✓          | ✓       | –         |
| `customer.write`  | Create and edit                                                                              | ✓     | ✓     | –          | ✓       | –         |
| `customer.manage` | Limits, payments, credit notes, merge, archive, statements, loyalty, credit and KYC settings | ✓     | ✓     | ✓          | –       | –         |
| `kyc.approve`     | Approving KYC cases                                                                          | ✓     | ✓     | –          | –       | –         |

On the till, `customer.read` and `customer.write` are allowed. Drawer account payments use the existing `sale.create`.

### Till SQLite step 9 (`packages/db/sqlite/src/till.ts`)

- New tables: `customer_lookup` (indexed on org and phone) and `customer_upload` (the outbox for created and updated events).
- New table: `account_payment` (a document, like a shift document).
- `sale_draft` gains `customer_id`.
- `sale_draft_tender` is rebuilt to allow credit and loyalty and to add `points`.

## Tests (written first by `test-author`)

### Notion-required

**`tests/integration/customers/credit/limit.test.ts`: "Credit sale over limit refused"**

- With a limit of GH₵100, a GH₵80 sale is accepted.
- A GH₵30 hold is refused with 409 `CREDIT_LIMIT` (GH₵20 available).
- A v5 event with no hold gets `INVALID_PAYMENT`, and no rows are written.
- Two GH₵60 holds race from two devices: one succeeds.
- An unverified customer with no deposit gets `NOT_ELIGIBLE`.
- A GH₵50 deposit lets an unverified customer buy GH₵50 on account but not GH₵51.

**`tests/integration/customers/loyalty/fold.test.ts`: "Loyalty balance equals ledger fold"**

Settings: 100 bps, 1 point = GH₵0.01.

| Event                                       | Points         |
| ------------------------------------------- | -------------- |
| Earn on sales of GH₵50, GH₵120 and GH₵33.35 | +50, +120, +33 |
| Redeem on a GH₵20 sale                      | −100           |
| Earn on the remaining GH₵19                 | +19            |
| Refund GH₵60 of the GH₵120 sale             | −60            |
| **Balance**                                 | **62**         |

- The API, `SUM(points)` and the last running balance all show 62.
- No balance column exists.
- An `UPDATE` on the ledger raises an error.

**`tests/integration/sales/customers/b2b.test.ts`: "B2B sale carries buyer TIN onto the invoice and fiscal payload"**

- The till quick-creates "Kofi Traders Ltd" (TIN `C0012345678`) offline, sells to it, and the sale uploads before the customer.
- The customer exists on the server, `sale.customer_id` is set, and the customer upload replays.
- The buyer `{name, tin}` appears in all four places: the v3 receipt, the till's local receipt, the ESC/POS bytes, and `fiscalPayload().buyer.tin`.
- A walk-in sale has buyer `null`.

### Done-when e2e

**`tests/e2e/till/ui/customers/recognise.spec.ts`: "A regular customer is recognised at the till by phone number"**

- Runs on a real host and server.
- Ama Mensah is pulled to the till.
- Keyboard only: Alt+U, then `024 123 4567`, then Enter, Enter. The basket chip shows her name.
- The server sale has her `customer_id`.
- With the server down she is still found.
- axe check and screenshots.

### Further integration tests

**Customer records**

| File                | Covers                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customers/records` | Create and replay; validation; search; tenancy; role gates; audit; change feed                                                                                                        |
| `customers/merge`   | Ledger transfers, so both folds equal the pre-merge sum; the loser is archived and leaves the till lookup; a sale using the loser's id lands on the winner; holds are released; audit |
| `customers/archive` | Refused with a balance, points or open holds; unarchive                                                                                                                               |
| `customers/export`  | Balances come from the folds; `=HYPERLINK` is neutralised; the register CSV is guarded with no float                                                                                  |

**Credit**

| File                  | Covers                                                                                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `credit/holds`        | Release; TTL; an old hold still settles its sale; replay; 403                                                                                                                                                                           |
| `credit/statement`    | Opening, running and closing balances; deposits show as credit balance; who may pay; immutability                                                                                                                                       |
| `credit/notes`        | A credit note lowers the balance and needs a reason; a refund of an account sale becomes a credit note first, then points, then cash                                                                                                    |
| `credit/ageing`       | FIFO allocation into buckets at fixed dates                                                                                                                                                                                             |
| `credit/interest`     | Interest is charged once per period on overdue balances only. A replayed period is a no-op. 0 bps does nothing.                                                                                                                         |
| `credit/delivery`     | A statement email has a PDF attached (Maileroo fake) and the link; the SMS summary carries the link; one `statement_delivery` row each; failure is recorded; no double send                                                             |
| `statements/links`    | A token opens the public statement JSON and PDF with no session. A tampered token, an expired one, a revoked one or one from another org gets 404 with no detail. Views are counted. The page shows only that customer and that period. |
| `statements/schedule` | Monthly on day 5 (fake clock): customers over the minimum get one delivery per channel. Running the period again sends nothing. A settings change wakes the flow; turning it off ends it. Box shell and Workers.                        |

**Loyalty**

| File                | Covers                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loyalty/settings`  | Off by default; validation; `LOYALTY_OFF`; 403                                                                                                                                                        |
| `loyalty/redeem`    | `POINTS_SHORT`; held points are counted; whole points only                                                                                                                                            |
| `loyalty/tiers`     | Spend crosses a tier, so the next earn uses the tier's bps; the rate is stored on the entry                                                                                                           |
| `loyalty/expiry`    | With 30 days, lots expire FIFO and redeemed points are not expired; the balance is still the fold                                                                                                     |
| `loyalty/transfers` | 40 points move A → B as a pair of entries, so both folds change and the org total doesn't. Refused: `POINTS_SHORT` (held points count), same customer, archived, loyalty off, 403. Audited.           |
| `loyalty/notices`   | Gold at GH₵1 000 over 365 days: the projection gives the downgrade date, and the notice goes 14 days before, once. A new sale before then cancels the notice. With notice days at 0, nothing is sent. |

**Workflow and till**

| File                         | Covers                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workflows/account`          | The account workflow sleeps until the next due moment, posts interest and expiry, ends when nothing is due, and an earn wakes it; it runs on the box shell and on a fake clock |
| `sync/customers/pull`        | Feed v4; upcast from v3; snapshot keeps pending customers; merged and archived customers drop out                                                                              |
| `till/customers/quickcreate` | Offline create; upload after sales; replay; duplicate phones; `PERMISSION_DENIED`                                                                                              |
| `till/customers/edit`        | An offline edit shows locally at once and uploads. With a concurrent portal edit, fields resolve last-writer-wins and both versions are audited. It never blocks the queue.    |
| `till/customers/tenders`     | Offline gives `OFFLINE_UNAVAILABLE`; hold, complete and push; release on remove or void; can't park the basket                                                                 |
| `till/accounts/payment`      | An offline cash payment uploads and lowers the balance; the shift's expected cash includes it; X/Z lines show on-account, points and payments                                  |
| `sync/versions`              | v4 sale is upcast to v5; v2 receipt reads as v3                                                                                                                                |

**KYC**

| File                   | Covers                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflows/kyc/credit` | Default org: OTP, then approval with no ID, sets the limit and `kyc_verified_at`. With "ID required" on, skipping the ID gets `ID_REQUIRED`. A Ghana Card or passport is stored masked with a fingerprint. Approving a case with an ID needs `idSighted`. A duplicate ID is flagged on the case. No ID number or OTP appears in the audit log, workflow steps, `kyc_case` or logs. |
| `workflows/kyc/staff`  | Approval grants the role; rejection leaves it alone; 403; last-owner rule                                                                                                                                                                                                                                                                                                          |
| `workflows/kyc/expiry` | OTP 10 minutes; at most 3 sends; 5 attempts; 7-day decision window, after which a late decision gets 409                                                                                                                                                                                                                                                                           |
| `audit/redact`         | `otp`, `id_number` and `card_number` are masked                                                                                                                                                                                                                                                                                                                                    |

**Workers**

- `tooling/worker/tests/{kyc,account}/flow.test.ts`.
- The edge and portal config tests cover the new bindings and secrets.

### Further e2e (axe, keyboard and screenshots in each)

**Till**

- `customers/dialog` (create, edit, invoice TIN, duplicates, offline, no permission) at 1920, 1440, 1366, 1024, 768 and 390.
- `customers/tenders`.
- `accounts/payment`.
- The dashboard tiles.
- The shift X/Z lines.

**Portal**

- `customers/{list,account,merge,statement,loyalty}`
- `kyc/review`
- `settings/credit`
- The role matrix goes from 32 to 36.

**New helpers**

- `tests/support/customers/{seed,http,till}.ts`
- `tests/support/till/customers/scenario.ts`
- The Maileroo fake is reused if it already exists, otherwise added under `tooling/maileroo`.

## Changes by package

### Small shared changes

- `@shopper/utils`: `csv.ts` (`toCsv`).
- `@shopper/money`: `unitsOf(amount, unit)`.
- `@shopper/audit`: `redact()` gains `otp`, `id_number` and `card_number`.
- `@shopper/db-pg` and `@shopper/db-sqlite`: the model above.

### `@shopper/core`: `src/customers/` (`@shopper/core/customers`)

**Customer records**

| File          | Contents                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `commands.ts` | create, update (bumps version), `till.create`, `till.update` (version or LWW), archive and unarchive, `ensureSaleCustomer` (`ON CONFLICT`, scope check, merged → winner) |
| `merge.ts`    | `customer.merge`                                                                                                                                                         |
| `queries.ts`  | List, read with account summary, sales (including merged ids), phone twins                                                                                               |
| `export.ts`   | `customerCsv`                                                                                                                                                            |
| `error.ts`    | `CustomerError`                                                                                                                                                          |

**Credit**

| File                  | Contents                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| `credit/holds.ts`     | Create, release, `consumeHolds`                                          |
| `credit/payments.ts`  | Payment (portal or till), limit, credit note                             |
| `credit/statement.ts` | Opening balance, running `SUM() OVER`, closing balance                   |
| `credit/ageing.ts`    | Pure FIFO buckets                                                        |
| `credit/interest.ts`  | `postInterest(period)`                                                   |
| `credit/refunds.ts`   | Allocate a refund: account first, then points, then the original tenders |

**Loyalty**

| File                  | Contents                                                 |
| --------------------- | -------------------------------------------------------- |
| `loyalty/settings.ts` | Loyalty settings, plus tier CRUD                         |
| `loyalty/points.ts`   | Pure `pointsEarned`, `pointsReversed` and `expiringLots` |
| `loyalty/ledger.ts`   | `earnPoints`, `reversePoints`, `expirePoints`, history   |
| `loyalty/transfer.ts` | `loyalty.transfer`                                       |
| `loyalty/tiers.ts`    | `tierOf` and `tierProjection` (pure); `sendTierNotice`   |

**Other customer modules**

- `accounts/due.ts`: `nextDue(customer)`, a pure function. It returns the earliest of the next interest date, the next lot expiry and the next tier notice date.
- `statements/document.ts`: statement JSON, built from `statement.ts`.
- `statements/links.ts`: `statement.link`, `statement.link.revoke`, `readStatementByToken`.
- `statements/schedule.ts`: `statementRunDue` (pure next run date) and `fanOutStatements(period)`.
- `statements/send.ts`: `statement.send`, which inserts the delivery row and enqueues it.
- `statements/deliver.ts`: the queue consumer. It renders the PDF through the Renderer port and sends through Maileroo or Arkesel.
- `schemas/customers/*`: inputs, `tinSchema`, `customerSnapshot`, and the events `customer.created`, `customer.updated` and `account.payment`, all v1.

**Sales**

- `schemas/till/sale.ts`:
  - `customer` is nullable and optional.
  - Tender kinds gain credit and loyalty.
  - `saleEvent` becomes v5, decoded with `createEventDecoder(5, …, {4: upcast})`.
- `sales/accept.ts`: `ensureSaleCustomer`, then `consumeHolds`, `earnPoints` and the account wake. `recordChanges` comes last.
- `sales/tenders.ts` and `till/tenders/settle.ts`: account tenders map to `hold_id` and count as non-cash.

**Refunds**

- `refunds/accept.ts` and `till/refunds/*` use `credit/refunds.ts`.

**Receipts**

- Receipt v3 adds a `buyer` block and the new tender kinds, with an upcast from v2.
- `receipts/fiscal.ts`: `fiscalPayload`, a pure seam that Day 20 submits.

**Change feed**

- `customerUpsert` for created, updated, merged and archived customers.
- `FEED_VERSION` becomes 4, with snapshots v4 and a v3 upcast.

**Till side**

- `till/customers/*`: create, update, find, attach.
- `till/accounts/payment.ts`.
- `till/lookup/customers.ts`.
- `till/complete.ts`: extract `till/sale/snapshot.ts` first.
- `till/shifts/report.ts`: the new X/Z lines and expected cash.
- `till/reports.ts`: Customers and Returning customers counts; the CSV moves to `toCsv`.

### `@shopper/auth`: KYC (`@shopper/auth/kyc`)

**Files**

| File               | Contents                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `kyc/documents.ts` | ID types, a format regex per type, `maskId`, `idDigest` (HMAC, sharing `hmacHex` with `links/tokens.ts`) |
| `kyc/settings.ts`  | `kyc.settings.set` (`kyc_id_required`, accepted types)                                                   |
| `users.ts`         | Extract `grantMemberRole`, keeping `assertCanGrantRole` and the last-owner rule                          |

**Commands** (`kyc/commands.ts`)

- `kyc.case.open`
- `kyc.otp.issue` and `kyc.otp.check`
- `kyc.id.record`: ID is optional unless required. It stores the masked number and fingerprint, flags a duplicate ID, and moves the case to `review`.
- `kyc.id.skip`: allowed only when ID is not required.
- `kyc.decide`
- `kyc.expire`

**Workflow** (`workflows/kyc.ts`, `runKyc`)

1. Send the OTP.
2. Wait for verification, with resends allowed. A timeout expires the case.
3. Wait for the ID step, or skip it.
4. Wait up to 7 days for the decision.
5. Close.

Events carry only `{action}`. The instance id is the case id.

### `@shopper/api`

**Customers**

- `GET`/`POST /customers`
- `GET`/`PATCH /customers/:id`
- `POST /customers/:id/{archive,unarchive,merge}`
- `GET /customers/:id/{sales,statement,ageing,loyalty}`
- `POST /customers/:id/{payments,credit/notes,statements,statement-links}`
- `DELETE /customers/:id/statement-links/:linkId`
- `POST /loyalty/transfers`
- `GET /public/statements/:token` and `/pdf`: no session; rate-limited by the existing RateLimiter
- `PUT /customers/:id/limit`
- `GET /customers/export.csv`
- `GET /customers/ageing.csv`

**Settings:** `GET`/`PUT /settings/{loyalty,credit,statements,kyc}` and `/loyalty/tiers` (CRUD).

**KYC:** `POST /kyc`, `/kyc/:id/{resend,verify,id,skip-id,decision}`, `GET /kyc`, `/kyc/:id`.

**Till sync:** `POST /sync/customers` (created and updated events), `POST /sync/accounts/payments`, `GET /sync/customers/:id/account`, `POST /sync/customers/holds`, `/holds/:id/release`.

**Other edits**

- Sale version picklist becomes `[4, 5]`.
- `problem.ts` maps the new error codes.
- `app.ts` mounts the new routes.
- **`runtime.ts`: add `customers|kyc|loyalty|settings` to the `isPublicRequest` regex.**
- `types.ts`: `kyc`, `account` and `statementSchedule` launchers.

### `@shopper/sync`

- Customer and account-payment upload workers on `createDocumentUploadWorker`.
- Pull and apply for customers. `KNOWN_VERSION` becomes 4.
- Bridge `schemas/bridge/{customers,accounts}.ts`: find, create, update, attach, account, `tender.account`, `account.payment`.
- `draftView.customer`.

### Platform shells

Load `/cloud-box-parity`, `workers-best-practices` and `cf docs search` first. No port changes.

- **Box till host:** `packages/adapters/box/src/till/host/{customers,accounts}.ts`, wired into `dispatch.ts` and the `transport.ts` allow-list.
- **Cloudflare:** `packages/adapters/cf/src/workflows/flow.ts` extracts the shared `cloudflareFlow`; momo and auth move to it. Then `kyc.ts`, `account.ts` and `statements.ts`, about 20 lines each. `runtime.ts` wires `KYC_FLOWS`, `ACCOUNT_FLOWS` and `STATEMENT_FLOWS`. Statement delivery and tier notices run on the existing notifications queue consumer (`apps/edge`).
- **Box:** `packages/adapters/box/src/workflows/{kyc,account,statements}.ts` on `memoryWorkflow`, with relaunch on boot.
- **Apps:** `apps/edge/cloudflare.config.ts` and `src/index.ts` (bindings and workflows `shopper-{kyc,account,statements}-<stage>`); `apps/portal/cloudflare.config.ts`, including the public `/statement/*` route in the prerendered shell; `apps/box/src/app.ts`.
- **Tooling:** `playwright.config.ts` starts the Arkesel and Maileroo fakes.
- **Secrets:** none new, since links use the existing link secret. Per the worker-secrets memory, check that staging already has every required secret before the push.

## UI

### Figma

File `4MtEIWv8yBUBYgkrk4ubPk`, read-only.

| Frame                   | Used for                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| Checkout 333:9119       | "Add Customer" and "Create Invoice" tiles                          |
| Till dashboard 312:8385 | "Customers" and "Returning Customers" tiles                        |
| Purchases 99:2496       | Customer column                                                    |
| Payment 99:1142         | Tender cards for On account and Points, and for the drawer payment |

There are no frames for the customer, statement, ageing, merge, loyalty, tier, KYC or settings screens, or for the till dialogs. They are composed from the Inventory area patterns, the purchases table, and the shift report styles. The gap goes in the remarks.

### Till (`apps/till/ui`)

**Before anything else:** extract `hooks/sale/shortcuts.ts` from the sale screen, and put customer state in `sale/customers.ts`.

**Customer dialog** (`components/sale/customer/{dialog,form}.tsx`)

- Opened by **Add customer** (Alt+U) or **Create invoice** (Alt+I).
- Find by phone, then ↑/↓ and Enter.
- If nothing matches, quick-create inline.
- Alt+E edits the attached customer, offline too. Alt+R removes them.

**Customer chip:** name, masked phone, TIN and tier.

**Tenders:** **On account** (Alt+5) shows what is available, including any deposit. **Points** (Alt+6). F5 charges.

**Take account payment** (menu, Alt+A; `components/accounts/payment.tsx`)

- Find the customer, then enter the amount in cash or MoMo.
- Prints a payment receipt.

**Shift X/Z:** the new lines on screen and in ESC/POS.

**States:** empty, duplicates, offline (account tenders disabled with "Needs a connection"; drawer cash payments still allowed), no permission, inline over-limit and points-short errors, and a loading skeleton.

**Elsewhere:** the purchases Customer column, the receipt buyer block, the dashboard tiles, and harness scenarios.

### Portal (`@shopper/backoffice`)

The Customers area has tabs **Customers**, **Ageing**, **Identity checks** and **Loyalty**. Nav item "Customers" needs `customer.read`.

| Route                                    | What it shows                                                                                                                                                                                                                                                                                                        | Keys                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/customers`                             | Search; segments All, On account, Business and Archived; columns Customer, Phone, Type, Tier, Owed / limit, Points, Last visit                                                                                                                                                                                       | `/`, N new, D CSV                                                                              |
| `/customers/$id`                         | Summary cards (owed or deposit, available, points, tier with "Moves to Silver on 12 Nov", KYC badge) and a "shares a phone" flag with a Merge action. Tabs: Purchases; Statement (range, running balance; Send by SMS or email, PDF download, Copy link, active links with revoke, delivery history); Points history | E edit, P payment, C credit note, L limit, K verify, M merge, T transfer points, Alt+A archive |
| `/customers/ageing`                      | Ageing buckets table and CSV                                                                                                                                                                                                                                                                                         | D CSV                                                                                          |
| `/kyc`                                   | Queue and review: verified phone, masked ID and its type (or "No ID provided"), duplicate-ID warning, an "ID document sighted" checkbox (required to approve when an ID was given), approve or reject                                                                                                                | A, R, Mod+Enter                                                                                |
| `/loyalty`                               | Settings (enabled, earn %, point value, expiry days, tier notice days) and the tier table with add, edit and archive                                                                                                                                                                                                 | Mod+Enter                                                                                      |
| Settings › Credit, statements & KYC      | Terms days; monthly interest %; statement schedule (off or monthly, day, channels, minimum balance) with "Next run 5 Nov"; "Require an ID document for KYC"; accepted ID types                                                                                                                                       | Mod+Enter                                                                                      |
| `/statement/$token` (public, no sign-in) | The shop's name, the customer, the period, opening and closing balances, the entries, and Download PDF. Phone-first layout. A not-found state for bad, expired or revoked links. Never shows the nav.                                                                                                                | –                                                                                              |

**Transfer points dialog:** pick the recipient by phone or name, enter the points (showing what is available) and a reason, then confirm.

**Merge dialog:** pick a winner. It shows both balances and the result, and asks for confirmation.

**KYC start sheet**

1. Phone and the requested limit or role.
2. OTP.
3. ID type, number and full name, with **Skip** when ID is not required.

**States:** every screen has a measured skeleton (`/skeleton-audit`), an empty state with the next action, an error with retry, `OfflineNote` with writes disabled, and `Gate`/`NoPermission`.

**Code layout:** queries live in `queries/customers/*`, `queries/kyc.ts` and `queries/settings/*`, with the shop id in every key. `lib/download.ts` is extracted from `queries/register/csv.ts`.

## Rules at risk

| Rule                           | How the plan keeps it                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Money                          | All amounts are Money via `@shopper/money`. Points are integers via `unitsOf`. Interest uses `mulRate` on Money. No floats; the register CSV float is removed.                 |
| Append-only, balance is a fold | DB triggers. No balance column. Merge, expiry and interest are new entries, never updates. A test asserts this.                                                                |
| Audit                          | Every write goes through `defineCommand`. Sale side effects go in the `sale.accept` payload. `redact()` is extended. A test scans every store for ID and OTP secrets.          |
| Tenancy                        | Composite foreign keys. Till customer ids are scope-checked. A hold matches device, cashier and branch.                                                                        |
| Sync versions                  | Sale v5, feed and snapshot v4, receipt v3; `customer.created`, `customer.updated` and `account.payment` start at v1. A data reset and till DB reset go in `deployment.md`.     |
| Push queue                     | Account tenders are refused only when forged. Edits resolve last-writer-wins and never block the queue.                                                                        |
| Workflows                      | Interest, expiry and KYC are Workflows with instance id = business key. No cron, no polling. Delivery is fire-and-forget on the existing queue. No new Durable Object or port. |
| Layers                         | KYC is in auth; `toCsv` is in utils. No Cloudflare imports outside adapters.                                                                                                   |
| Permissions                    | Data only: 36 codes, set in the migration and the role defaults.                                                                                                               |
| Size and no effects            | Split the four files at the limit first. Handlers, `useSuspenseQuery` and ref callbacks only.                                                                                  |
| Privacy                        | No ID data reaches a till. ID numbers are stored only as an HMAC fingerprint plus a masked form.                                                                               |

## Execution workflow

### Subagent models (owner rule, 22 Oct)

Every Agent call passes `model` and `effort`. Opus runs at low or medium, mostly low. Sonnet runs at medium or high. Haiku runs at medium, high or xhigh.

| Agent                             | Model                                                                           | Effort |
| --------------------------------- | ------------------------------------------------------------------------------- | ------ |
| `Explore` / `explorer`            | haiku                                                                           | high   |
| `checker`                         | haiku                                                                           | medium |
| `code-simplifier`                 | haiku                                                                           | xhigh  |
| `test-author`                     | sonnet                                                                          | high   |
| `implementer`                     | sonnet, high, for most slices; opus, low, for the money-critical slices 4 and 7 |        |
| `ui-builder`                      | sonnet                                                                          | high   |
| `ui-reviewer`                     | sonnet                                                                          | medium |
| `reviewer`, per slice             | opus                                                                            | low    |
| `reviewer`, whole branch          | opus                                                                            | medium |
| `planner`, if a re-plan is needed | opus                                                                            | low    |

After approval, save this as a feedback memory.

### Setup

1. `git switch -c day17-customers main`, then `git merge origin/day16-inventory`, resolving conflicts. Commit.
2. Save the plan to `docs/plans/day17/plan.md`, with progress tracked in `progress.md`.
3. Reset the data: `vp run db:reset`, then migrate and seed.

### Each slice runs the same loop

1. `test-author` writes the failing tests (`/tdd-slice`).
2. `implementer` or `ui-builder` makes them pass (`/ui-screen`, `/cloud-box-parity`).
3. Break the slice once on purpose and watch a named test fail.
4. `checker` runs `vp check`, `vp run guard` and the slice's tests.
5. **UI slices only:** `/ui-verify` with `playwright-cli` at desktop, laptop, tablet, mobile and till sizes, covering every state, the keyboard path, the console and overflow. Then `/skeleton-audit` and `ui-reviewer`.
6. `reviewer` (`/pre-merge-review`). Fix every verified finding.
7. Commit `Day 17 slice N: …`. Never stage `.claude/settings.json`. No AI attribution.

### Slices

| #   | Slice                                                                                                                                                                                               | Key tests                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 0   | Branch, Day 16 merge, plan saved                                                                                                                                                                    | –                                                                                 |
| 1   | Migration 0025 (whole model), 36 permissions, customer records API with archive and merge, `toCsv`, customer CSV, register CSV guard, `runtime.ts` regex, `problem.ts`                              | `records`, `merge`, `archive`, `export`, matrix                                   |
| 2   | Customers on the till: feed v4, SQLite step 9, find, create, edit and attach, upload lane, bridge and host                                                                                          | `pull`, `quickcreate`, `edit`                                                     |
| 3   | Sale v5 with customer (merged → winner), receipt v3 buyer, `fiscalPayload`                                                                                                                          | **b2b**, `versions`                                                               |
| 4   | Credit: holds, deposits, `consumeHolds`, payments, limit, credit notes, refund allocation, statement, ageing                                                                                        | **limit**, `holds`, `statement`, `notes`, `ageing`                                |
| 5   | Drawer account payments, `shiftTotals`, X/Z lines (screen and ESC/POS), payment receipt                                                                                                             | `till/accounts/payment`                                                           |
| 6   | Loyalty: settings, tiers, earn, redeem, refund reversal, points transfers                                                                                                                           | **fold**, `settings`, `redeem`, `tiers`, `transfers`                              |
| 7   | Account workflow: `nextDue`, interest, points expiry, tier projection and downgrade notices, `cloudflareFlow` extraction, both shells, settings fan-out                                             | `interest`, `expiry`, `notices`, `workflows/account`, Workers                     |
| 8   | Statements: document, `StatementView` PDF via Renderer, Maileroo email, Arkesel SMS, `statement_delivery`, queue consumer, signed links with public API, statement-schedule workflow on both shells | `delivery`, `links`, `schedule`                                                   |
| 9   | KYC with ID optional and manual: settings, documents, commands, `runKyc`, both shells, routes                                                                                                       | `kyc/{credit,staff,expiry}`, `redact`, Workers                                    |
| 10  | Till UI: dialog (create, edit, invoice), chip, account tenders, drawer payment, purchases column, dashboard tiles, X/Z, harness                                                                     | **recognise**, `dialog`, `tenders`, `payment`                                     |
| 11  | Portal customers: list, detail, statement send, payment, credit note, limit, merge, archive, ageing, CSV                                                                                            | `customers/*`                                                                     |
| 12  | Portal loyalty, tiers, transfer dialog, credit, statement and KYC settings, KYC start and review, public statement page                                                                             | `loyalty`, `settings/credit`, `kyc/review`, `statements/public` (at 390 and 1366) |
| 13  | Wrap-up                                                                                                                                                                                             | Full suite                                                                        |

**Deliberate breaks:**

| Slice | Break                               | Test that must fail        |
| ----- | ----------------------------------- | -------------------------- |
| 3     | Drop the customer upsert            | `b2b`                      |
| 4     | Drop `FOR UPDATE`                   | The race case              |
| 4     | Accept a credit tender with no hold | The forged-event case      |
| 6     | Earn on the points-tendered amount  | `fold` shows 63, not 62    |
| 7     | Post interest twice in a period     | The `interest` replay case |
| 8     | Skip the token's org check          | The cross-org link case    |
| 9     | Put the ID number in an event       | The secrets scan           |

### Slice 13 wrap-up

1. Run the full integration, e2e and Workers suites in the background.
2. Review the whole branch with `reviewer` (opus, medium) and `ui-reviewer`.
3. Update the docs in one last commit:
   - `architecture.md`: holds, folds, deposits, merge, the account workflow, version bumps.
   - `platforms.md`: the KYC and account workflows, `cloudflareFlow`, the box memory engine.
   - `testing.md`: the new helpers and fakes.
   - `deployment.md`: 0025, the version bumps, data and till DB reset, the new secret.
   - `developer-experience.md`: the Maileroo and Arkesel fakes and the public statement URL.
   - `frontend.md`: the Customers area.
   - `docs/plans/day17/verification.md`, with screenshots.
4. Check that staging has every required secret, then **push once** and open a PR against `main`. Bind it with ccd_pr and read CI.
5. Update the Notion Day 17 row (`3eba2c99-9ce9-81ee-9397-cbd83c70992a`):
   - Status Done; tick the tasks and tests.
   - Add a "Remarks" section in the Day 16 format: shipped, tests, review, decisions to confirm, upgrade notes, known limits, the missing Figma frames, and the schedule slip from the added scope.

## Open questions (they don't block; the defaults stand)

1. Should granting a role with cash authority _require_ an approved KYC case? **Default: no.**
2. Should interest be compound or simple? **Default: simple.** Interest is charged on the overdue principal only; past interest entries are excluded from the base.

## Still left out

- An automated Ghana Card or identity provider check. Verification is manual by owner decision; a provider is one adapter file later.
- The GRA E-VAT submission (Day 20 consumes `fiscalPayload`).
- Box workflow timers that survive a restart (Day 36, Rivet). Until then the box relaunches workflows on boot.
