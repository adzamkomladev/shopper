# Day 51 verification — v1.5 · 6 · Customers, receipts, loyalty

## What shipped

- **Accounts in the relay org.** Shoppers of an on-prem shop sign in with their phone on the relay org (unchanged
  OTP flow, now covered by a test there).
- **Consent on the box.** `customer.online_shared_at`, set by `customer.online.set` (`PUT /customers/:id/online`,
  `customer.write`, wakes the Publisher). Consent is the phone's: it applies to every live record with that phone, and
  any phone edit (portal or till) clears it. Not a till field; the customer feed and sale events are unchanged.
- **Publish what the webapp shows.** A Publisher step (`relay/customers/box.ts`) runs the box's own `readShopPoints` and
  receipt query (newest 100, with receipt documents) for each shared phone. It hashes the result
  (`relay_published` entity `customer`) and sends only changes to `POST /relay/customers`. That endpoint takes a
  strict allowlist (`relayCustomers`), 25 customers a batch. Withdrawals ride the first batch. Ids are marked before
  sending, so a copy whose acknowledgement was lost can still be withdrawn.
- **Relay copy.** `relay_customer` and `relay_receipt`, replaced whole per customer (`relay.customers.published`, counts
  only in the audit chain). On a relay org `/shop/account/points`, `/receipts` and `/receipts/:id` read the copy;
  receipts have no PDF (the till PDFs stay on the box; the page renders the receipt document).
- **Orders join in-store customers.** A relayed order is linked on receipt to the box's oldest live customer with its
  phone, or to a new customer made from the order (published to the tills): `online_order.customer_id`.
- **Fiscalised on the box.** Relay orgs no longer record a fiscal document at payment. The box records the order's
  invoice from the relay's receipt at hand-over, and its fiscal lane signs it. A refund writes a credit note only
  when the order's invoice was fiscalised. Every publish now carries the box's tax profile (TIN, VAT date, price
  mode), so checkout tax on the relay and the invoice the box fiscalises agree.
- **Customer page.** "Show receipts and points online" switch in the customer detail, shown only on a box selling
  online; "Their receipts and points stay on this box." when off.
- Migration `0052_relay_customers.sql` (replayable).

## Tests

- `relay/customers.test.ts` (new, 9): an opted-out customer's receipts never leave the box (fails with the opt-in filter
  removed); the webapp's balance equals the box's `readShopPoints` and ledger fold, and follows new entries; the
  webapp lists and opens the box's receipts, `pdf: false`, another shopper's is 404; opting out withdraws the copy;
  a field outside the allowlist is a 400 and nothing is stored; the box's tax profile reaches the relay; consent
  follows the phone (duplicates, phone edits); a first copy whose acknowledgement was lost is still withdrawn; agreeing never shares an archived duplicate.
- `relay/fulfilment.test.ts` (new, 4): an order joins the in-store customer by phone; an unknown phone becomes one
  customer even when redelivered; the box fiscalises at hand-over and the relay never does; a cancel before hand-over
  refunds on the relay with no credit note. All failed on the code before the change.
- Updated: `relay/publish.test.ts` and `relay/publisher.test.ts` (the `shop` row), `tax/schema/tax.test.ts` (two
  tables), tenant sweep body for `PUT /customers/:id/online`.
- `e2e/portal/customers/online.spec.ts`: keyboard toggle, persists across reload, hidden off a box; screenshots at
  1920, 1440, 1366, 768 and 390 with axe and horizontal-overflow checks (pass).
- Relay (51), orders, payments, fiscal, customers and shop suites (88 files, 380 tests) pass; `vp check` and
  `vp run guard` are clean; full `vp test --run` timed out locally (58 min); with Rivet started, the Rivet, conformance and sealed-box tests that it reached pass. The Electron receipt-render equivalence test fails on this machine (pixel tolerance), unrelated to the change; CI runs the full suite.

## Review

- Codex `gpt-6.2-sol` (medium), pass 1: 11 findings. 6 confirmed and fixed: a lost first acknowledgement; consent
  following an edited phone; a receipt moving between batches; the relay org without the box's tax profile; a credit
  note with no invoice; phone-level consent across duplicate records. 5 not changed, with reasons in `plan.md`.
- Pass 2 (on the fixes): 6 findings. Fixed: agreeing no longer stamps archived duplicates (withdrawing still clears
  them); the pre-send marker is audited as `sending`, not `shared`. Already fixed: the publisher test's length. Not
  changed: syncing dated tax rules (both sides load the same national tax pack; Day 50's price check flags any tax
  difference); a box newer than its relay (the cloud always deploys first); re-hashing a customer whose receipt moved
  to another customer's batch when the later batch fails and the phone is corrected before retry (too unlikely for
  the code it needs).

## Known limits

- Purge of completed relay orders and the "What leaves your building" page are Day 53.
- No receipt PDFs on the relay; the shopper sees the receipt document.
- Online orders earn no points (cloud orders do not either).
- Staff record consent; shoppers cannot opt in from the webapp.
- The switch needs `product.read` to know the box sells online.
- The staff order does not yet show the linked customer.
- Every shared phone is recomputed each run (fine for a pilot; add a dirty flag if a shop shares thousands).
- Figma has no customer-profile or shop-account frame; the switch follows the Components page and the customer screen.
