# Day 52 — v1.5 · 7 · Relay integration suite

## Context

Notion row "v1.5 · 7 · Relay integration suite" (Box, Sync, Tax, P0). Automated scenarios:

- Box goes offline mid-order → paused, deadline, cancel-and-refund offered
- Duplicate order delivery
- Reject and refund
- Price change between publish and order
- Tax parity: cloud total equals box total for 200 random baskets
- Field allowlist: no forbidden field in any batch
- Box on protocol `publish/1` against a relay supporting 1 and 2

**Done when:** every scenario runs green in CI.

The v1.5 proposal adds: "Box down with paid orders waiting: after the acceptance deadline (default 30 minutes in
opening hours) the customer is offered cancel-and-refund or wait", and "Relay supports the current and previous
publish protocol".

Working rules (user, memory): no subagents; tests first; one commit per slice; push once at the end; PR, watch CI
until green (fix and push if red), merge; update Notion with remarks. Data is disposable. Review: Codex `gpt-6.2-sol`.
Branch `day52-relay-suite` from `main` at `8910592e` (PR #72 merged).

## What exists (traced)

| Scenario                  | Today                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline → paused          | `heartbeat.test.ts`: silent 5 min in opening hours pauses the branch; heartbeat resumes it                                                                                              |
| Offline → deadline        | `workflows/order.ts`: unaccepted after `ACCEPT_WITHIN_MS` (10 min) → **automatic refund**, cloud and relay alike. No offer, no "wait"                                                   |
| Cancel-and-refund offered | Not built. `POST /shop/:code/orders/:id/cancel` (`cancelOwnOrder`) cancels only unpaid (`placed`) orders                                                                                |
| Duplicate delivery        | `orders.test.ts` "the same order delivered twice is processed once" — covered                                                                                                           |
| Reject and refund         | `orders.test.ts` "an order the box cannot fill is rejected, refunded and the shopper is told" — covered                                                                                 |
| Price change              | `orders.test.ts` "a price changed after the order: the paid price is honoured and the mismatch flagged" (+ tax-only change) — covered                                                   |
| Tax parity                | Not built. Both sides price with the same `quoteCart` (`storefront/cart`) — the relay over its published copy at checkout, the box over its own rows in `checkPrices` on acceptance     |
| Field allowlist           | `publisher.test.ts` checks `/relay/publish` batches only; `/relay/customers` has its own strict schema test. Not checked: every request of a full run (customers, events, images, beat) |
| Protocol versions         | Not built. Requests carry no protocol; the relay has no notion of versions                                                                                                              |

## Decisions

1. **Keep the covered scenarios where they are.** Duplicate delivery, reject-and-refund and price change already run
   in CI against the real workflows; copying them into a new file would be duplication. The verification record maps
   each Notion scenario to its test.
2. **A relay order past its deadline is offered, not refunded.** For a relay org only, the order workflow's accept
   wait is 30 minutes by default (`RELAY_ACCEPT_WITHIN_MS`; tests pass `acceptWithinMs`). When it runs out, an audited
   command `offerOrderCancel` stamps `online_order.overdue_at` and texts the shopper ("The shop has not confirmed
   your order yet. Cancel it for a full refund, or keep waiting."). The workflow then waits `store.accepted` again
   until the slot ends; then it refunds as `not_accepted`, as today. Cloud orders keep the 10-minute automatic
   refund. `shortcut: the deadline is wall-clock, not "opening hours" time; the storefront takes orders only in hours, upgrade if shops report late-evening orders.`
3. **The shopper's cancel covers an overdue paid order.** `cancelOwnOrder` takes the flow launcher: a `placed` order
   is cancelled as today; a `paid`, unaccepted order with `overdue_at` is refunded through the existing
   `refundPaidOrder` (reason `cancelled`), its payment refund sent, and the workflow woken with
   `store.accepted { cancelled: true }` (the same path a store cancel uses, so no second refund). Anything else is the
   existing 409 "can no longer be cancelled". The box never takes a refunded order (`relayInbox` lists paid ones);
   one it took and could not tell is answered as refunded on its next run (existing Day 50 path).
4. **Protocol versions ride the signed path.** The box adds `?protocol=publish/1` (`RELAY_PROTOCOL = 1`) to every relay
   request; the query is part of the signed path, so it cannot be altered. The relay speaks its own version and the
   one before (`relayProtocol` option on `createApi`, default `RELAY_PROTOCOL`); a request naming no protocol is
   `publish/1`. Anything else is a **426** before the licence nonce is spent: older → "Update this box to keep Online
   Orders"; newer → "The relay is older than this box; it will retry". The Publisher keeps a 426 like a 401/402/403
   (shown on the settings page; the next minute's run retries). No `publish/2` shape exists yet, so the test runs the
   relay at protocol 2 to prove a `publish/1` box keeps working against a newer relay.
5. **The allowlist test covers every request of a whole run.** One run in the inbox world (catalogue, photos,
   opted-in customer, an order taken and accepted, heartbeat) captures every body the box sends; each is checked
   against an explicit key allowlist per path, and private values seeded on the box (cost price, supplier name and
   phone, staff names, another customer's phone, a customer's credit limit, TIN and note) never appear anywhere.
6. **Tax parity uses the real publish and the real quote on both sides.** A seeded PRNG builds 200 baskets over a
   catalogue covering standard, zero-rated and exempt classes, `each` and `kg` units, branch-specific and org-wide
   prices, both branches, pickup and delivery. After one Publisher run, `quoteCart` on the relay equals `quoteCart` on
   the box line by line (price id, base, VAT, NHIL, GETFund, COVID, gross) and in total, under the shop's price mode,
   then again after switching price mode on the box and publishing.

## Behaviours as tests (written first, each seen failing)

`tests/integration/relay/suite.test.ts` (new; `inboxWorld`, which gains an `acceptWithinMs` option):

1. **Box offline mid-order: paused, deadline, cancel-and-refund offered.** The box beats, a shopper pays, the box
   goes silent: after 5 minutes in hours the branch is paused (new checkout refused); the paid order passes its
   deadline → `overdue_at` set, the shopper texted, the order still `paid` (not refunded). The shopper cancels with
   their key → `refunded`, payment refund sent once, one credit note; the box comes back, never takes it, its stock
   untouched.
2. **Box offline mid-order: the shopper waits.** Same start; the box comes back after the offer and accepts → the
   order goes on as accepted; a shopper cancel now is refused (409).
3. **An overdue order nobody accepts is refunded when its slot ends.**
4. **A cloud shop's unaccepted order is still refunded at its deadline** (no offer; guards the cloud path).
5. **Tax parity: cloud total equals box total for 200 random baskets** (Decision 6).
6. **No forbidden field in any request of a whole run** (Decision 5).

`tests/integration/relay/protocol.test.ts` (new; `relayCloud` + `send`):

7. **A box on `publish/1` against a relay speaking 1 and 2** reads status, publishes and beats.
8. **A box on `publish/0` (too old) or `publish/3` (too new) is refused 426 before its nonce is spent**, with the
   reason; a request naming no protocol is `publish/1`.
9. **The Publisher keeps a 426 on the settings page** and stops the run (a relay at protocol 3 refuses the box).

Existing tests to update: `relay/orders.test.ts` if it depends on the old relay timeout; the tenant sweep body for
the cancel route is unchanged (same route). Shop e2e for the order page gains the overdue state.

E2E `tests/e2e/shop/order` (or the existing order-page spec): an overdue paid order shows "Waiting for the shop",
"Cancel and refund" works and the page turns to "Refunded".

## Changes

- **`@shopper/db-pg`**: `online_order.overdue_at` (timestamptz, null); migration `0053_relay_overdue.sql`
  (forward-only, idempotent).
- **`@shopper/core`**:
  - `workflows/order.ts`: relay deadline and offer, second accept wait (file stays under 250 lines; helpers move to
    `orders/` if needed).
  - `orders/flow.ts` (or `orders/fulfil/stages.ts`): `offerOrderCancel` command + shopper SMS; `markOrderPaid`
    returns `relay`.
  - `orders/fulfil/actions.ts`: `cancelOwnOrder` refunds an overdue paid order.
  - `orders` view: `overdue` on the shop order view.
  - `schemas/relay.ts`: `RELAY_PROTOCOL`; `relay/publisher.ts`: protocol on every send, 426 is a refusal.
- **`@shopper/api`**: `relayRoutes` protocol check (`relayProtocol` option through `createApi`); shop cancel route
  passes the flow launcher.
- **`apps/shop`**: `schemas/checkout.ts` `overdue`; `components/order/confirmation.tsx` status copy for an overdue
  paid order and `CancelOrder` labelled "Cancel and refund" with "or keep waiting" copy.
- **Tests support**: `inboxWorld({ acceptWithinMs })`.

## UI

- Shop order page, paid and overdue: status panel title "Waiting for the shop", detail "The shop has not confirmed
  your order yet. Cancel it for a full refund, or keep waiting and we will text you when it is confirmed." Below it
  an outline button "Cancel and refund" (pending "Cancelling…", error inline `role="alert"`). After success the page
  shows the existing "Refunded" state.
- Figma: the supplied file's pages are New Login, Research, Web Flow (till checkout and dashboard), Components, Login,
  Dashboard and Barcode Scanner; none has a shopper order page. Follow the Components page (outline button, tokens)
  and the existing order page.
- `/ui-verify` with playwright-cli at desktop, laptop, tablet, mobile, till; keyboard (Tab to the button, Enter);
  console; overflow.

## Rules at risk

- **Money:** refunds reuse `refundPaidOrder` (ledger + credit note in one transaction); no arithmetic added.
- **Workflows:** the offer is a workflow step with its audited command; no cron, no polling.
- **Audit:** `offerOrderCancel` and the shopper refund are `defineCommand`s.
- **Security:** the protocol sits in the signed path; the 426 check runs before the nonce so a refused request can be
  retried; the shopper cancel still needs the order key.
- **Size:** `workflows/order.ts` 150 lines, `publisher.ts` 232 — keep both under 250.

## Slices (commit after each)

- **S0 Agent files.** `docs/engineering/ai-workflow.md` loop step 7 "Ship" (push once, PR, watch CI to green, fix and
  push on red, merge) and the review model `gpt-6.2-sol` stated in `AGENTS.md` definition of done (already in roles).
- **S1 Protocol.** Tests 7–9, then relay check + box protocol.
- **S2 Offline mid-order.** Migration, workflow offer, shopper cancel-and-refund; tests 1–4.
- **S3 Parity and allowlist.** Tests 5–6 (fix whatever they find).
- **S4 Shop notice.** Order page state, e2e, `/ui-verify`.
- **S5 Docs, review, ship.** `platforms.md` relay section (protocol, deadline), owner guide for online orders,
  `verification.md`; `vp check`, `vp run guard`, `vp test --run`; `/pre-merge-review` (Codex `gpt-6.2-sol`); push,
  PR, CI green, merge; Notion row ticked with remarks.
