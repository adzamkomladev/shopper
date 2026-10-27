# Day 23 verification

What was run to prove the payments work, and the checks that went red on purpose first. The plan is in
[plan.md](plan.md).

## Integration (Postgres 18 fixture)

| File                                       | What it proves                                                                                                                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payments/webhook/replay.test.ts`          | A Paystack webhook or Hubtel callback replayed three times applies once: one `payment_event`, one audit row, one store sequence, one envelope, one workflow event                                                                                     |
| `payments/refund.test.ts`                  | A MoMo-tender refund calls the provider refund once and records `payment_refund`; a replay is a no-op; a timeout verifies once, then fails with a reason                                                                                              |
| `payments/hubtel.test.ts`                  | An org on Hubtel charges in decimal cedis, a callback is confirmed through the status API, a wrong amount is refused, Paystack orgs are untouched                                                                                                     |
| `payments/reconciliation.test.ts`          | Settlement lines short by GH₵ 1 and an unknown reference are stored and flagged; per-day and per-shift expected, declared, settled and variance by tender; branch scope                                                                               |
| `transactions/explorer.test.ts`            | Search by receipt, customer and MoMo reference; filters, keyset pages and status counts; the drill-down; branch scope; the CSV row count matches the query                                                                                            |
| `approvals/{lifecycle,refund}.test.ts`     | Request, SMS, approve, `approval.decided`, single-use redemption; declined, expired, reused, other amount, sale or device, self-approval and out-of-scope refused                                                                                     |
| `notifications/receipt.test.ts`            | A sale with a customer email enqueues the receipt; the rendered email holds receipt number, lines, total and fiscal code; redelivery or a double click sends once                                                                                     |
| `billing/dunning.test.ts`                  | Pricing; invoice, checkout and email on the billing day; reminders at +3 and +7, read-only at +14 (402 on changes, reads and tills carry on); payment replayed 3× pays once; an older overdue invoice keeps read-only; the watchdog starts the period |
| `tooling/cloudflare/{edge,portal}.test.ts` | The four Workflow bindings, their exports and the Hubtel secrets on both Workers                                                                                                                                                                      |

Worker suite (workerd): `tooling/worker/tests/billing/dunning.test.ts` runs `BillingWorkflow` to read-only through
Hyperdrive. Locally the full worker suite exceeds its 300 s harness timeout under load; the selected file passes
directly and CI runs the whole suite.

## Portal (Playwright, e2e stack)

Run: `pnpm exec playwright test --project=portal tests/e2e/portal/{transactions,payments,approvals,billing}`. Filled
states are the API's answers replayed (`tests/support/payments/{busy,manage}.ts`); quiet and permission states use the
real API. Screenshots at 1920, 1440, 1366, 768 and 390, each with an axe pass and an overflow check, are in
[screenshots/portal](screenshots/portal).

- Transactions: a busy day with status tab counts, `/` search, `]` steps the day, status tabs narrow; a receipt's
  drill-down (lines, totals, payment, refund, fiscal document, audit trail); M emails once and Backspace in the
  address field edits it; a quiet and a filtered empty state; a missing sale; no `report.read`.
- Reconciliation: a settlement short by GH₵ 1 is flagged "Amount mismatch" with its receipt; `[` `]` step the day;
  R refreshes once; a refused refresh says so; a quiet day; no permission.
- Approvals: two pending requests with countdowns; A approves and focus moves to the next request; D declines with a
  reason; empty inbox; a cashier has no inbox.
- Billing and settings: the read-only banner on any page links to billing, the overdue invoice's Pay now link opens
  its Paystack checkout (P); no invoices yet; Hubtel picked and saved with Mod+Enter, disabled when its keys are
  missing; a cashier has neither page.
- Till (`tests/e2e/till/ui/purchases/return/remote.spec.ts`): ask remotely, waiting, approved, declined and offline.

## Break-it checks

- Dropping the `ne(id)` guard in `payInvoice` made "paying one period keeps the back office read-only" fail.
- Rendering the status tabs without their panel failed axe (`aria-valid-attr-value`), which is how the tabs bug was found.
- With every Approve button disabled while one request was answered, the "focus moves to the next request" check failed; it passed once only the answered request waits.

## Reviews

Codex (`gpt-6.1-sol`) reviewed each slice. S10 findings fixed: Backspace in the email dialog, discount approvers locked
out of the inbox, the transactions table not owning its scroll, focus lost after approving, and a silent refresh
failure.
