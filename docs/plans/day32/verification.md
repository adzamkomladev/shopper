# Day 32 verification

Done when a customer can place an unpaid order.

- `tests/e2e/shop/checkout.spec.ts` fills a cart from a product page and a tile, sees the till's total, checks out
  for pickup and lands on "Awaiting payment" on the real shop host.
- `tests/integration/shop/cart.test.ts` proves the cart total equals the till total for the same basket.
- `tests/integration/shop/holds.test.ts` proves a reservation stops the shop and the till overselling the last unit.

## Tests

| Suite                                                                         | What it proves                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/shop/cart.test.ts`                                         | the online cart's lines and totals equal a provisioned till's `quoteLine` for the same basket, inclusive and exclusive, with a branch price; short, unpriced and hidden lines are flagged; the delivery fee                                                                                                     |
| `tests/integration/shop/orders.test.ts`                                       | a guest's unpaid order holds its stock, starts its workflow, arms the expiry, takes the store's next number and is audited with the phone masked; a full, off-grid or closed slot and delivery-off are refused; one order per checkout key; the key reads it back and nothing else does; the price at placement |
| `tests/integration/shop/holds.test.ts`                                        | two concurrent checkouts for the last unit give one order and one `stock` refusal; a unit already gone (a synced till sale) cannot be ordered; an expired hold gives the unit back before any alarm                                                                                                             |
| `tests/integration/ports/holds.test.ts`, `tooling/worker/tests/holds.test.ts` | StockHold conformance on the box twin and the Durable Object (workerd): the alarm releases what expired and re-arms for the next                                                                                                                                                                                |
| `tests/integration/workflows/orders/flow.test.ts`                             | unpaid orders expire with their hold and free the stock; payment moves the holds past the slot and waits for the store; the instance id must be the order id                                                                                                                                                    |
| `tests/integration/auth/administration/fulfilment.test.ts`                    | the owner saves branch fulfilment (audited); closes before opens is refused; a cashier gets 403; another shop gets 404                                                                                                                                                                                          |
| `tests/integration/security/tenant/sweep.test.ts`                             | every new route is in the tenant sweep                                                                                                                                                                                                                                                                          |
| `tests/e2e/shop/checkout.spec.ts`                                             | cart → checkout → "Awaiting payment"; the losing shopper in a last-tin race is told and finds the line flagged; a dropped connection says so and the retry places the order once                                                                                                                                |
| `tests/e2e/portal/branches/fulfilment.spec.ts`, `ledger/books.spec.ts`        | the owner turns on delivery with a fee by keyboard; the general ledger is in the sidebar                                                                                                                                                                                                                        |

Break-it checks:

- Not refusing short lines in `order.place` failed all three holds tests.
- Leaving holds at the checkout deadline after payment failed the flow test (found by review).
- Earlier slices: dropping the branch price from the cart quote, the box re-arm, and the release on expiry each
  failed their test.

## UI

`shoot` ran axe and the horizontal-overflow check at 1920, 1440, 768 and 390 for the cart, checkout and confirmation
(screenshots in `screenshots/`), and `captureSizes` for the branch fulfilment sheet. The checkout was redesigned after
the first pass: three days of every slot stacked on mobile, so slots are now picked by day, then start time.

## Review

Codex (`gpt-6.1-sol`, `codex review --base main`) found three issues, all fixed:

- Paid orders kept the 30-minute hold expiry, so paid stock could be sold again. Payment now moves the holds to a
  day after the slot ends.
- A refused submit kept the used Turnstile token. Each refusal now draws a fresh challenge.
- A dropped connection on Place order showed nothing. It now says so; the same checkout key makes the retry safe.

## Open issues

- An offline till can still sell a held unit; the conflict shows when it syncs (offline-first limit).
- Box holds and order waits are in-process until the Rivet engine (Day 36); holds are re-armed from PostgreSQL at boot.
- Paid holds lapse a day after the slot until the store's pick and fulfil steps exist.
- Payment (Day 33) and the store's order inbox are not built; orders stay "Awaiting payment".
- Figma's MCP hit its plan limit mid-build, so the cart follows the Web Flow "Checkout" frame as read earlier.
