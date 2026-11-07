# Day 34 verification

- **Integration:** `tests/integration/orders/fulfil/{schema,accept,stages,consistency,safety,staff,notify,reviews}.test.ts` (43 tests):
  constraints; the ten-minute accept window, decline and cancel; slot timing, pick and collect waits and their refunds;
  **order → pay → accept → pick → substitute → hand over** with stock, books, credit note, supplementary invoice and the
  partial refund agreeing (and a replay changing nothing); the dearer-substitute cap; the staff API with sessions,
  permissions, branch scope and the shared runtime; status texts sent once; the shopper's timeline, cancel and review;
  the review workflow, screening and moderation. Existing order, payment, shop, ledger, fiscal, security and customer
  suites were rerun after the changes.
- **Break checks (each fails a test when broken):** the stock return of a short pick, the substitute price cap, the
  original-cost reversal, and the runtime route allowlist.
- **Browser (20 specs):** `tests/e2e/portal/orders/{queue,pick}.spec.ts`, `tests/e2e/shop/fulfil.spec.ts` and
  `tests/e2e/till/ui/shell/orders.spec.ts` pass: every stage, scan-to-pick by keyboard, short and substitute, confirmations,
  refused steps, empty/error/retry states, the shopper's progress, change card, review form (keys 1 to 5), cancel, the
  store page's reviews and the register entry. Axe and horizontal-overflow checks at 1920, 1440, 768 and 390;
  screenshots in `screenshots/`. The browser run caught the runtime route allowlist missing `orders` and `reviews`.
- **Codex review (`gpt-6.1-sol`):** six findings, all confirmed and fixed with tests: weighed credits in whole pesewas,
  refund webhooks matched to the refund they name, aggregate substitute stock at finishing, returns at the cost the sale
  booked, a review window (and its form), and terminal checkpoints when a run ends early.
- **Not verified:** real Paystack/Hubtel/SMS, a live Cloudflare deploy (CF Workflows buffering of early events is avoided
  by reading state rather than relying on it), real scanners and hardware. The Figma MCP was over its plan limit, so the
  screens follow existing portal and shop patterns. A single local run of the whole suite did not finish inside its
  55-minute cap; the areas touched, the workerd suite (alone) and every browser spec were run, and CI runs the rest.
- **Known limits:** substitutes must be online-visible products; the review request text has no link (no shop URL
  setting yet); the shopper's page still shows the first-ordered totals beside the "Your order changed" card; Hubtel refunds
  (including partial) stay `refund_due`; box waits and sleeps are in-process until Rivet (Day 36); a weighed credit in a
  tax-exclusive org is not rounded to a pesewa.
