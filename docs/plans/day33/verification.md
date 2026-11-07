# Day 33 verification

- **Integration:** `tests/integration/payments/orders/{settle,failure,refund,hubtel,notify}.test.ts` (28 tests): card and mobile
  money payment, signed webhooks, replays, wrong signature and amount, receipt + fiscal document + books + stock +
  confirmation in one transaction, failed and retried attempts, hold expiry, late, duplicate and racing payments,
  compensation of an unaccepted order, Hubtel, confirmations sent once. The wider suites (security sweep, shop, fiscal,
  ledger, payments, receipts, notifications) pass; the workerd suite passes alone.
- **Break checks:** posting to the books removed, the hold-lapse check removed and the workflow queue removed each fail a test.
- **Browser:** `tests/e2e/shop/pay.spec.ts` (mobile money, card by keyboard, declined then retry) and the Day 32 checkout spec
  pass; screenshots at 1920, 1440, 768 and 390 in `screenshots/` with axe and overflow checks.
- **Codex review (`gpt-6.1-sol`):** six findings, all confirmed and fixed with tests: hold deadline, workflow queue,
  settling payment chosen for compensation, refund claimed before the provider call, charge outage, webhook redelivery.
- **Not verified:** real Paystack/Hubtel, a live Cloudflare deploy and real hardware. The Figma MCP was rate-limited, so the
  pay panel follows the Day 30-32 shop theme.
- **Known limits:** online orders are not yet in the store-day sales report or the transactions explorer (they read `sale`);
  Paystack's code step for mobile money is not offered online; Hubtel refunds wait as `refund_due`; box waits are
  in-process until Rivet (Day 36).
