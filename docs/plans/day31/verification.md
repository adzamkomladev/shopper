# Day 31 verification

Done when the store is browsable and indexable, and the owner keeps real books.

- `tests/integration/shop/storefront.test.ts` hides a product at a branch that has none on hand, while
  it still shows at the branch that has stock. It also proves the price shown equals the till price at
  the same moment.
- `tests/e2e/shop/store.spec.ts` browses, searches and switches branch on the real shop host. It reads
  the product page's canonical link, robots tag and Product JSON-LD, and the sitemap.
- On the books side, every money event posts a balanced entry in its own transaction. The trial
  balance balances, and assets equal liabilities plus equity plus current earnings.

## Tests

| Suite                                                                                                               | What it proves                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/ledger/journal.test.ts`                                                                          | the database refuses an unbalanced or one-line entry at commit and any UPDATE/DELETE of journal rows; a new org has the chart; a replayed source posts once; lines merge per account                                               |
| `ledger/sale.test.ts`, `refund.test.ts`                                                                             | a golden sale posts cash net of change, sales ex-tax and each levy equal to the snapshotted line tax, rounding, and COGS at last received cost (no cost → no COGS line); refunds mirror it and restocked lines return to inventory |
| `ledger/credit.test.ts`, `loyalty.test.ts`                                                                          | the customer accounts control balance equals the sum of the customers' credit folds; the loyalty liability equals points × point value                                                                                             |
| `ledger/shift.test.ts`, `stock.test.ts`, `settlement.test.ts`                                                       | drops to the safe and over/short; costed receipts, damage at last cost and found stock; settlements net of fees to the bank                                                                                                        |
| `ledger/manual.test.ts`                                                                                             | manual entries balance on accounts of this org and post once per id; a manual entry is reversed once and never before its own day; a synced posting is never reversed; malformed ids are 404; the lock date; cashier 403           |
| `ledger/reports.test.ts`                                                                                            | trial balance balances; P&L net = income − expense; the balance sheet balances; a day's ledger sales and levies equal the tax report                                                                                               |
| `tests/integration/shop/storefront.test.ts`                                                                         | `catalogue_public` honours online_visible and archive; out of stock at the branch hides the product; branch price override and no early future price; search, category, paging; other shop isolation                               |
| `tests/integration/catalogue/images.test.ts`                                                                        | the photo grant; bytes that don't match the registered size or SHA-256 are refused; only a linked photo of a visible product redirects; another shop's asset is 404                                                                |
| `tests/integration/security/tenant/sweep.test.ts`                                                                   | every ledger, store and photo route is in the tenant sweep                                                                                                                                                                         |
| `tests/e2e/portal/ledger/books.spec.ts`, `tests/e2e/portal/catalogue/image.spec.ts`, `tests/e2e/shop/store.spec.ts` | post and reverse a journal by keyboard; statements and CSV; account drill-down and the lock date; cashier forbidden; the product photo upload; the store, its SEO and its dead ends; axe at every size                             |

Break-it checks:

- Removing the SHA-256 comparison failed the photo mismatch test.
- Letting a synced sale entry be reversed failed `manual.test.ts` (201 instead of 422).

## Review

Codex (`gpt-6.1-sol`) was over its usage limit until 4 November, so `/code-review` ran in its place.
These findings were fixed:

- Reversal is limited to manual entries (422 otherwise). The Reverse button shows only on manual
  entries.
- A reversal dated before the entry it reverses is refused.
- Malformed ledger ids answer 404 instead of a database error.
- The journal says when it shows only the newest 500 entries.
- A malformed category address shows the not-found page.
- Each listing page past the first is canonical under `?page=N`.
- The tile photo is decorative, because the link already names the product.

## Browser checks (`/ui-verify`)

- Books (journal, entry, trial balance, balance sheet, account) and the store (home, search, product)
  were shot at 1920×1080, 1440×900, 768×1024 and 390×844. They are in `screenshots/`.
- Axe passes at every size, with no console errors.
- Fixed while checking:
  - Scrollable tables can now be reached by keyboard.
  - The statements tab now owns a labelled panel.
  - Header contrast on statement section rows was too low.
  - The lock field shared an id with the lock button.
  - `/` did not focus the store search before the page held focus.

## Left for later

- The journal table scrolls sideways on a 390px phone. It is reachable by keyboard, but a stacked
  layout would read better.
- There are no 1366×768 till-size shots: the books and the store are not till screens.
- The skeletons were sized by eye against the loaded boxes. They were not measured with
  `/skeleton-audit`.
- Replacing a product photo leaves the old object in the bucket. Deleting it needs a blob delete in the
  Blobs port.
- No history was backfilled into the ledger, because the data was disposable. Books start at the first
  posting after the migration.
- There is no cart yet; it comes on Day 32.
