# Day 19 · GRA E-VAT fiscalisation: verification

Branch `day19-fiscal`, from `main` at `3c647f5`. One commit per slice.

| Slice | What                                                                             | Commit    |
| ----- | -------------------------------------------------------------------------------- | --------- |
| 1     | `fiscal_doc` / `fiscal_archive` (migration 0027), the SDC port and the mock SDC  | `3505672` |
| 2     | VAT invoices and credit notes become fiscal documents; audited submit and retry  | `7ae2f64` |
| 3     | FiscalLane Durable Object and its in-process box twin, under shared conformance  | `04e3a40` |
| 4–5   | Provisional receipts signed on pull (receipt v5, feed v6); hourly fiscal archive | `df91a8d` |
| 6     | Fiscal API and the portal Fiscal tab                                             | `e04d6a6` |

Slice 7 (the done-when test, docs) rode along with slices 4–6.

## Notion tests

| Test                                                                         | File                                                       | Broken once on purpose             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| SDC down → sale completes, doc pending → SDC up → accepted                   | `tests/integration/fiscal/outage.test.ts`                  | `sale.accept` awaits the SDC → red |
| Rejected doc appears on the dashboard                                        | `tests/integration/fiscal/dashboard.test.ts`               | Rejection not written → red        |
| Every accepted doc appears in an archive bundle                              | `tests/integration/fiscal/archive.test.ts`                 | Straggler sweep skipped → red      |
| Submissions for one store reach the mock SDC in receipt order, after retries | `packages/conformance/src/cases/lane.ts` (box and workerd) | Lane skips a failing head → red    |

Also broken on purpose: the e2e "a document that cannot be read says so in the sheet" (read error not passed to the
sheet → red against a fresh portal build).

## Suites

- Fiscal integration (`tests/integration/fiscal`, `till/fiscal`, `ports/lane`, `sync/receipts`): 17 files, 41 tests.
- Workerd (`tests/integration/edge/worker.test.ts`): 62 tests, including the five FiscalLane conformance cases.
- Portal e2e `tests/e2e/portal/tax/fiscal.spec.ts`: 5 specs (plus setup).
- Full integration: 321 files, 1409 of 1410 passed (6 skipped); the one failure, a feed-version pin in `till/search/maintenance`, was fixed and passes on rerun.

## Screens

`docs/plans/day19/screenshots/portal`: the Fiscal tab with documents at 1920, 1440, 1366, 768 and 390; the empty,
SDC-not-connected state at 1920, 1440, 768 and 390; the detail sheet with Retry at 1440 and 390. Every shot ran an
axe pass and a horizontal-overflow check. The first mobile pass showed the table squeezed to one row by the archive
card; the documents area now keeps a minimum height and the page scrolls. Figma has no fiscal frames; the tab follows
"Previous purchases" (45:852).

Not run: a `/skeleton-audit` of the Fiscal tab skeleton, and a till-UI shot of the purchase detail's E-VAT row (its
text is covered by the till fiscal receipt test).

## Review

Codex (`gpt-6.1-sol`) reviewed each slice. Fixed: the box lane rechecking a store after a settle; young stranded
documents re-enqueued too early; a DB connection failure inside a retry; the branch name missing from the document
detail; a signature that arrives while a provisional PDF renders (now stored stale and rendered again); archive
download links expiring on an open page (refetched every 4 minutes); a document read failure leaving the sheet
loading forever (now an error with Try again).

The whole-branch review raised two more, both fixed after the first push: a till far enough behind (over 50,000
changes) to take a snapshot skipped the feed rows carrying its signatures (it now fetches them for its provisional
receipts and applies them with the snapshot: `till/fiscal/receipt.test.ts`); and a document whose enqueue failed
waited for the store's next sale (every till pull now hands the store's oldest stranded document back to its lane,
with no cron: `fiscal/stranded.test.ts`). Each test went red with its fix removed.
