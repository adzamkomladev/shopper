# Day 52 — verification record

Each Notion scenario of "v1.5 · 7 · Relay integration suite" and the test that runs it in CI.

| Scenario                                                                 | Test                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Box goes offline mid-order → paused, deadline, cancel-and-refund offered | `relay/offline.test.ts`: "box offline mid-order: paused, past the deadline the shopper is offered and takes a refund"; "… the shopper waits and the box takes it when it is back"; "an order on time is not the shopper's to cancel, and an overdue one nobody takes is refunded at its slot's end". Pause itself: `relay/heartbeat.test.ts`. Shopper page: `e2e/shop/fulfil.spec.ts` "a paid order the shop has not confirmed in time offers a refund, by keyboard" |
| Duplicate order delivery                                                 | `relay/orders.test.ts` "the same order delivered twice is processed once" (existing, Day 50)                                                                                                                                                                                                                                                                                                                                                                         |
| Reject and refund                                                        | `relay/orders.test.ts` "an order the box cannot fill is rejected, refunded and the shopper is told" (existing)                                                                                                                                                                                                                                                                                                                                                       |
| Price change between publish and order                                   | `relay/orders.test.ts` "a price changed after the order: the paid price is honoured and the mismatch flagged" (existing)                                                                                                                                                                                                                                                                                                                                             |
| Tax parity: cloud total = box total, 200 random baskets                  | `relay/parity.test.ts`: 200 seeded baskets, then 50 after the box adds a tax rule and switches price mode                                                                                                                                                                                                                                                                                                                                                            |
| Field allowlist: no forbidden field in any batch                         | `relay/allowlist.test.ts` (catalogue, tax rules, customers, heartbeat, private values seeded on the box); photos in `relay/storefront.test.ts`, order events in `relay/fulfilment.test.ts`, all through `tests/support/relay/allowlist.ts`                                                                                                                                                                                                                           |
| Box on `publish/1` against a relay supporting 1 and 2                    | `relay/protocol.test.ts` (4 tests: 1 against 1+2, 426 for too old/new with the nonce unspent, the Publisher's 426 on the settings page, a pre-Day 52 shop row without tax rules still publishing)                                                                                                                                                                                                                                                                    |

## Found on the way

- **The relay priced with its own Ghana 2026 rule, not the box's.** A box that applied a new tax pack charged one rate
  in store and the relay another online. The parity test failed on it; the box now publishes its whole set of tax
  rules (`shop.taxRules`) and a relay org is provisioned without a rule of its own.

## Codex review (gpt-6.2-sol)

Fixed: legacy `publish/1` shop rows without `taxRules` still accepted (P1); a moved future rule date no longer clashes
with its replacement (P2); the first relay accept wait is capped at the slot end and no offer is made past it (P2); the
storefront reads a missing `overdue` as `false` during rollout (P2); photos and order events are on the allowlist test
(P2); a photo 426 is kept as the refusal reason (P3).

## Not covered

- The overdue deadline is wall-clock 30 minutes, not "opening hours" time (shortcut noted in `workflows/order.ts`).
- e2e "the store page shows the shop's average…" fails locally on "That branch is not here" (shop seed state); the
  change does not touch that page. CI is the judge.
