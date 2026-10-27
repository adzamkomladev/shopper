# Day 23 · Payments & transactions management

## Context

Day 23 of the Shopper schedule (Notion row "23 · Payments & transactions management", phase 3). It
closes the 27 Oct milestone: **stock, tax, audit, reports and payments are all manageable from the
portal.** Day 11 already shipped MoMo through Paystack (a `momo-payment` workflow with instance id =
reference, a signed `/webhooks/paystack`, a till push through StoreHub, and `tooling/paystack/server.ts`).
Day 15 shipped Z reports with declared and expected amounts per tender. Day 16 shipped Arkesel SMS and
Day 22 the store-day owner emails on the notification `Queue`. Today fills the gaps:

- Webhooks are not idempotent. A replayed Paystack event writes another audit row, uses another store
  sequence and sends another envelope.
- MoMo refunds are only recorded. No provider refund is made.
- There is no Hubtel, settlement reconciliation, transactions explorer, reconciliation screen,
  remote manager approval, digital receipt email, or Shopper subscription billing.
- CI runs as two long serial jobs: foundation takes about 40 minutes and e2e about 60.

**Your decisions (27 Oct):** billing is an invoice with a Paystack hosted-checkout link. Remote approval
covers refunds and discounts end to end. Hubtel is chosen by a per-org provider setting. Receipt emails go
out automatically when the customer has an email, plus a resend button.

**How I work:** everything runs in this session on Opus at medium effort, with no subagents. Tests come
first, then the code, then the test runs and fixes. Skills used: `tdd-slice`, `ui-screen`, `ui-verify`
(playwright-cli), `skeleton-audit`, `pre-merge-review`, and `cloud-box-parity` plus
`workers-best-practices` for bindings. MCPs: Figma, context7 (Paystack and Hubtel docs) and Cloudflare
docs. Codex reviews each slice and the whole branch:
`codex review --uncommitted -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`.
Branch `day23-payments` from `main` at `0b1f471`. Each slice is one commit after its tests and review.
The push happens once, at the end.
Dev, e2e and CI data is disposable. Migrations do no backfill, and I reset databases freely.

## Figma

- **Transactions list:** `55:2263` "Previous purchases". Title, Export CSV, search, date button,
  payments select, status tabs with counts (All, Completed, Refunded, Voided, Pending MoMo), and a table
  (time/receipt, customer, items, tender, cashier, status badge, total).
- **Transaction detail:** `55:3230`. Back link, header card (receipt, status, date, cashier,
  customer, Reprint/Email receipt), items table (qty, unit price, discount, tax, line total), order total
  card, "Payment and tender" card (MoMo reference, provider, status), receipt metadata (fiscal doc, SDC
  id, register), plus an **audit trail** card that is new and follows the metadata-card style.
- **Inputs and badges:** `12:66` components. Responsive tabs follow `227:4900`, and KPI tiles follow `339:9672`.
- **No Figma frames for:** reconciliation, approvals inbox, billing and payment settings. They follow the
  `55:2263` table pattern and the `339:9672` tiles. The remarks will say so.

## Slices (tests first in each; one commit each)

### S0 · Split CI into parallel jobs (`.github/workflows/ci.yml`)

- Add a composite action `.github/actions/setup/action.yml` for checkout, Bun, `setup-vp`, frozen
  install, an optional `storage:setup` and an optional Playwright install. Cache the pnpm store and the
  Playwright browsers.
- **Jobs (parallel):**
  - `check` runs `vp check`.
  - `guard` runs `vp run guard`.
  - `typecheck` runs `vp run typecheck`.
  - `build` runs `vp run build`.
  - `integration` is a 4-shard matrix. Each shard runs `vp test --run --shard=${i}/4` with Postgres and RustFS services.
  - `e2e` is a 3-shard matrix: `vp run e2e -- --shard=${i}/3`. Each shard uploads its own report.
  - `e2e-public` runs the public config.
  - `ci` is a final gate that `needs` every job. Branch protection points at this one job.
- Add `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` and per-job timeouts
  (integration 40, e2e 45).
- Check that Vitest `--shard` respects the `heavy` and `solo` project groups in `vite.config.ts`. Each
  shard runs its own `prebuild` global setup. Check that Playwright shards repeat the `setup` project.
  Write the job layout into `docs/engineering/developer-experience.md`.

### S1 · Schema: migration `0031_payments.sql` plus Drizzle (`packages/db/pg/src/schemas/payments/…`)

Split the current `schemas/payments.ts` into a folder: `payments/{base,events,refunds,settlements}.ts`, plus
`approvals.ts` and `billing/{subscriptions,invoices}.ts`. Every table has `org_id` and a UUIDv7 id, and
all money is integer.

- `payment` gains `provider` (`paystack|hubtel`) and `provider_fee`.
- `payment_event (org_id, provider, event_key UNIQUE(provider,event_key), reference, kind, received_at)`
  is the webhook dedupe ledger.
- `payment_refund (id, org_id, payment_id, refund_id, amount, status pending|processed|failed, provider_reference)`.
- `settlement (provider, provider_id UNIQUE, settled_on, gross, fees, net)` and `settlement_line
  (settlement_id, reference, amount, fee, payment_id NULL, flag ok|amount_mismatch|unknown_reference|missing)`.
- `approval_request (id, org_id, branch_id, device_id, requested_by, permission refund.approve|sale.discount,
  subject jsonb {saleId|receipt, amount, reason}, status pending|approved|declined|expired, decided_by,
  decided_at, expires_at, consumed_at)`.
- `subscription (org_id UNIQUE, status active|past_due|read_only, billing_day, next_invoice_on)` and `invoice
  (org_id, period, stores, terminals, amount, status open|paid|void, paystack_reference, checkout_url,
  paid_at)`.
- `org.momo_provider` defaults to `paystack`, and there is a `receipt_email (sale_id, email, request_key UNIQUE)` dedupe table.
- Add the permissions `payment.reconcile` and `billing.manage` to the auth permissions and seed roles. The
  explorer reuses `report.read` plus `branchScope`. Approvals reuse `refund.approve` and `sale.discount`.

### S2 · Idempotent webhooks + MoMo refunds (compensation)

- **Tests first:** `tests/integration/payments/webhook/replay.test.ts` covers "Webhook replayed 3× →
  applied once". One `payment_event` row, one `payment.momo.updated` audit row, one store sequence, one
  realtime envelope, one workflow event. The same check runs for Hubtel callbacks. `payments/refund.test.ts`:
  a MoMo-tender refund calls the provider refund once and records `payment_refund`. A replay is a no-op. A
  timeout leads to one verify, then `failed` with a reason.
- **Code:**
  - `updateMomo` takes an optional `event` and inserts it into `payment_event` with `ON CONFLICT DO NOTHING`
    in the same transaction. On conflict it returns early, so nothing is audited or published.
  - Add a `momo-refund` workflow (`packages/core/src/workflows/payments/refund.ts`, instance id = refund
    id). It runs refund, waits for the `refund.processed` webhook (24 h), verifies once, then records.
    Refund accept (`packages/core/src/refunds/accept.ts`) starts it for MoMo tenders.
  - Ledger: the Day 22 accountant journal stays the ledger. Confirmed payments that no sale tender uses show
    as "unapplied MoMo" in reconciliation (S4). No new ledger table.

### S3 · Hubtel provider behind the same steps

- **Tests first:** `payments/hubtel.test.ts`. An org on Hubtel charges `12.50` (decimal `toDecimal(2)`),
  the callback leads to a verify through the status API and then `confirmed`. A callback with a wrong amount
  is refused. Paystack orgs are unaffected.
- **Code:**
  - `packages/core/src/payments/provider.ts` defines the `MomoProvider` type (`charge`, `submitOtp?`,
    `verify`, `refund`). Paystack conforms as it is.
  - Add `packages/core/src/payments/hubtel/{client,callback,schemas/base}.ts`. Hubtel callbacks are
    unsigned, so every callback is confirmed through the status API before it is applied.
  - `runMomoPayment` picks the provider from `payment.provider`, which `startMomo` snapshots from
    `org.momo_provider`.
  - Add the route `/webhooks/hubtel`, the fake `tooling/hubtel/server.ts` (same pattern as the Paystack
    fake), the secrets `HUBTEL_CLIENT_ID|CLIENT_SECRET|MERCHANT_ACCOUNT` (edge, portal, box, `.env.example`),
    and Settings → Payments (provider select, `register.settings`).

### S4 · Settlement + tender reconciliation (per shift, per day)

- **Tests first:** `payments/settlement.test.ts`. The fake Paystack serves `/settlement` and
  `/settlement/:id/transactions`. One line is short by 100 and one reference is unknown. The settlement
  workflow stores and flags both, and `GET /reconciliation` returns the flags. The e2e spec
  `tests/e2e/portal/payments/reconciliation.spec.ts` covers "Settlement mismatch flagged on the
  reconciliation screen". `payments/reconciliation.test.ts` checks that per-shift and per-day expected
  amounts by tender equal the raw sum of tenders minus refunds, that declared amounts come from Z reports,
  that MoMo settled amounts come from settlement lines, and that variances follow. `branchScope` is honoured.
- **Code:**
  - Add a `settlement` one-shot workflow (`workflows/settlement.ts`, instance `settlement:<day>`), started
    by the watchdog like the audit anchor. It fetches, stores, matches by reference and flags, and every step
    writes its table, an audit row and `workflow_run`.
  - `POST /reconciliation/settlements/refresh` (`payment.reconcile`) starts the same id for a chosen day.
  - `packages/core/src/payments/reconciliation/{day,shift}.ts` reuses the shift totals in
    `core/shifts/totals.ts` and the tender fold in `core/reports/fold/tenders.ts`.

### S5 · Transactions explorer API

- **Tests first:** `tests/integration/transactions/explorer.test.ts`.
  - Search by receipt number, customer name or phone, and MoMo reference.
  - Filters: date range, branch, tender, status (completed, refunded, voided, pending MoMo) and cashier,
    with keyset pagination and status counts.
  - The drill-down returns lines with tax, tenders with payment and provider status, refunds, the fiscal
    document (Day 19) and the audit trail rows for the sale, its refunds and its payment.
  - A scoped member sees only their branches, and the CSV export row count matches the query.
- **Code:** `packages/core/src/transactions/{list,detail,export}.ts` and `packages/api/src/routes/transactions.ts`.

### S6 · Remote refund / discount approval (end to end)

- **Tests first:** `tests/integration/approvals/remote.test.ts`.
  - The device requests approval, the workflow is waiting, and the approver SMS is enqueued.
  - A manager approves in the back office. The till gets `approval.decided` through StoreHub. A refund
    synced with that `approvalId` is accepted, and `approver_id` equals `decided_by`.
  - These are rejected: declined, expired after 10 minutes (time advanced), reused (`consumed_at`), a
    different amount or sale, a different device, self-approval, and an approver outside the branch scope.
  - The till-ui e2e `tests/e2e/till/ui/approvals/remote.spec.ts` goes keyboard only: request, waiting,
    approved, then the refund completes. It also covers declined and offline (disabled, with a reason).
- **Code:**
  - Add an `approval` workflow (`workflows/approval.ts`, instance = approval id). It creates the request,
    enqueues an Arkesel `approval.requested` SMS to approvers holding the permission in that branch, waits
    for `manager_approval` (10 min), records the decision, and publishes the envelope.
  - API: device `POST/GET /approvals[/:id]`. Member `GET /approvals?status=pending` and `POST
    /approvals/:id/decision`.
  - Refund and discount accept check `approvalId` in the same transaction and set `consumed_at`. The synced
    refund and discount events gain `approvalId`, so their `v` is bumped with an upcaster.
  - Till host bridge ops `approval.remote.request|cancel` and the live type `approval.decided` go in
    `packages/sync/src/schemas/{bridge/approvals,live}.ts`. `ApprovalFields` (`apps/till/ui/src/components/approval/`)
    gains an "Ask remotely" tab (Alt+R) with waiting, declined, expired and offline states.

### S7 · Notifications: digital receipt email (+ queue routing)

- **Tests first:** `tests/integration/notifications/receipt.test.ts` covers "Digital receipt email
  enqueued and rendered". A sale with a customer who has an email enqueues `receipt.email` after commit. The
  consumer builds receipt JSON (`core/receipts/build.ts`) and renders HTML. The fake Maileroo receives the
  receipt number, lines, total and fiscal code. A redelivery or double click sends once (`receipt_email`).
  `POST /transactions/:id/receipt-email` resends.
- **Code:** `packages/core/src/receipts/email/{render,deliver}.ts`, wired into
  `core/notifications/deliver.ts`, plus `approval.requested` (Arkesel) and `invoice.*` (Maileroo) cases.
  The owner daily summary and Arkesel OTP already exist (Days 22 and 16), so I reuse them and do not rebuild them.

### S8 · Subscription billing & dunning

- **Tests first:** `tests/integration/billing/dunning.test.ts`, with time advanced.
  - On the billing day an invoice is created. Pricing: GHS 550 per store including 1 terminal, 300 for
    terminals 2–3, 250 for 4+, as integer money through `@shopper/money`.
  - A Paystack checkout link is initialised and the invoice email is enqueued.
  - No payment leads to reminders at +3 and +7 days, then `read_only` at +14.
  - While read-only, management mutations return 402 but GETs, billing routes, and till sync, sales and
    MoMo still work.
  - The `charge.success` webhook (with invoice metadata), replayed 3×, pays once and restores `active`, and
    the next period's instance starts. The watchdog restarts a dead chain. The box has no subscription and
    is never read-only.
- **Code:**
  - Add `packages/core/src/billing/{price,invoice,access}.ts` and a `billing` workflow (`workflows/billing.ts`,
    instance `billing:<org>:<period>`) that uses `sleepUntil` and `waitFor("invoice.paid")` with no polling.
  - Onboarding creates the subscription, with the first invoice one month after signup (my default; tell me
    if you want a different trial).
  - `readOnlyGuard` middleware in `packages/api/src/middleware/`. The Paystack webhook routes
    `metadata.invoiceId` events to billing.

### S9 · Platform wiring (both runtimes)

- Cloudflare: workflow classes `MomoRefundWorkflow`, `SettlementWorkflow`, `ApprovalWorkflow` and
  `BillingWorkflow` in `packages/adapters/cf/src/workflows/`, with bindings `MOMO_REFUND|SETTLEMENT|APPROVAL|BILLING`
  in `apps/{edge,portal}/cloudflare.config.ts`.
- Box: the in-process engine in `packages/adapters/box/src/workflows/` plus the watchdog timer.
- No new Durable Objects or crons. No port shape change is expected. If one turns out to be needed, I
  update `packages/conformance` and run it against both adapters.
- Extend `tests/integration/tooling/cloudflare/{edge,portal}.test.ts` for the new bindings and secrets.

### S10 · Portal screens (`@shopper/backoffice`, `ui-screen` + `ui-verify`)

- **Screens:**
  - `screens/transactions/{list,detail}/screen.tsx` follow Figma `55:2263` and `55:3230`.
  - `screens/payments/reconciliation/screen.tsx` has Day and Shift tabs: by-tender table of expected,
    declared, settled and variance with flag badges, plus "Refresh settlement".
  - `screens/approvals/screen.tsx` is the pending inbox with Approve and Decline (with a reason). It
    refreshes through the query's refetch interval, which is UI only.
  - `screens/settings/{payments,billing}/screen.tsx` and a read-only banner in the shell.
- Routes go in `routes/{transactions,payments,approvals}.tsx`, queries in `queries/<context>/`, and nav
  entries are permission-gated. The explorer gets Mod+K search plus `/`, `[`/`]`, `E` and `Enter` keys,
  and the inbox gets `A`/`D`. There is no `useEffect`.
- Each screen gets loading, empty, error, offline and no-permission states, with skeletons sized by `skeleton-audit`.
- e2e specs under `tests/e2e/portal/{transactions,payments,approvals,billing}/` include axe checks.
  `ui-verify` runs at 1920, 1440, 1366, 768 and 390, with screenshots in `docs/plans/day23/screenshots/`.

## Critical files

- Reuse: `packages/core/src/workflows/payments/momo.ts`, `packages/core/src/payments/{commands,paystack/*}.ts`,
  `packages/api/src/payments/routes.ts`, `packages/core/src/workflows/watchdog.ts`,
  `packages/core/src/notifications/deliver.ts`, `packages/core/src/receipts/build.ts`,
  `packages/core/src/shifts/totals.ts`, `packages/core/src/reports/fold/tenders.ts`,
  `packages/core/src/till/approvals.ts`, `packages/core/src/refunds/accept.ts`,
  `packages/audit` (`defineCommand`, `enqueueAfterCommit`), `tooling/paystack/server.ts`, `tooling/arkesel`.
- New code follows the folder rule. No `.ts` file over 250 lines and no `.tsx` over 300 (the guard checks).

## Verification

1. For each slice: break the change once on purpose and watch the new test go red. Then run
   `vp test --run <files>`, `vp check` and `vp run guard`, then the Codex review.
2. At the end: the full `vp test --run`, `vp run build`, `vp run typecheck`, `vp run e2e`, the public e2e
   and the worker tests. Then a whole-branch Codex review (`codex review --base main -c model="gpt-6.1-sol" -c
   model_reasoning_effort="medium"`) and `ui-verify` on every new screen against Figma.
3. Write `docs/plans/day23/{plan,verification}.md`. Update `platforms.md` (new workflows and bindings),
   `deployment.md` (migration 0031, Hubtel secrets, bindings) and `developer-experience.md` (CI layout).
4. Push `day23-payments` and open the PR (no AI attribution). Bind it with `ccd_pr` and turn on Auto-fix.
   On a CI failure: fix, commit and push until the new split CI is green, then squash-merge and
   fast-forward the local `main`.
5. Update the Notion Day 23 page: tick the tasks, set Status to Done, and add Remarks (decisions, what
   shipped, tests, review fixes, CI fixes, upgrade notes, known limits, process note).

## Known limits going in

- Hubtel settlement reconciliation is not in scope. Only Paystack settlements are fetched.
- Paystack stays one platform account (the existing `PAYSTACK_SECRET_KEY`). There are no per-org subaccounts.
- Billing is cloud only. On-prem licences and maintenance renewals are not billed by this workflow.
