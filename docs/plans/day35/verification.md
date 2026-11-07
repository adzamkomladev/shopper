# Day 35 verification

- **Integration (new):**
  - `tests/integration/reports/{online,substitute}.test.ts`: sales by day, cashier and tender, products, the dashboard,
    rolled-up days against live ones, a late paid order marking its day stale, and a refunded substitute's cost netting to nothing.
  - `tests/integration/transactions/online.test.ts`: list, search by receipt, phone and name, filters, branch scope, the CSV,
    and a duplicate attempt left out of the tenders.
  - `tests/integration/orders/view.test.ts`: the shopper's totals after a pick.
  - `tests/integration/orders/fulfil/link.test.ts`: the signed review link opens the order and takes one review; a changed,
    borrowed or expired link and a missing shop URL each fail as they should.
  - `tests/integration/payments/orders/otp.test.ts`: wrong then right code, a code taken but the prompt still on the phone,
    key and state checks, and the deadline.
  - Rerun: `tests/integration/{payments/orders,reports,transactions,orders}`, 150 tests passing.
- **Break checks:** the online fold in the sales report, the review token's order check, and the OTP step names (a reused
  name replayed the cached result, so the order was never paid). A test caught each one.
- **Browser (20 specs, `tests/e2e/portal/transactions/explorer.spec.ts`, `tests/e2e/shop/{fulfil,pay}.spec.ts`):** the online
  order row shows "Online shop" and its receipt opens `/orders/:id`. The shopper's page shows the picked totals. The review link
  opens the order in a fresh browser and posts `{ r, rating }`. The code step works by keyboard alone: a wrong code shows the
  network's reason, and the right one pays. Every shot passes axe and the horizontal-overflow check at 1920, 1440, 768 and 390,
  plus 1366 for the portal. Screenshots are in `screenshots/`.
- **Codex review (`gpt-6.1-sol`):** three findings, all confirmed and fixed with tests:
  - an accepted code whose prompt is still on the phone now goes back to `pending`, clearing the reason, so no more codes are taken;
  - a refunded substitute is costed on the day it went out;
  - a duplicate or late attempt owed back is no longer one of an order's tenders.
- **Not verified:** real Paystack OTP networks, a live Cloudflare deploy, and the Figma frames (the MCP is over its plan
  limit, so the screens follow existing patterns). The full suite runs in CI. One existing flake, the till OTP test
  `tests/integration/payments/otp.test.ts`, fails only under local load.
- **Known limits:**
  - Hubtel refunds stay `refund_due`, handled by hand.
  - Box waits and sleeps stay in-process until Rivet (Day 36).
  - If one product is both ordered and sent as a substitute in the same order, its refund is costed on the later day.
  - `SHOPPER_SHOP_URL` is empty for staging and production until the shop has a domain.
