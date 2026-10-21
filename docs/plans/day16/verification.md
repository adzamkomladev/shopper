# Day 16 verification

Run on 20–21 Oct 2026 on the Ubuntu dev box, branch `day16-inventory`. Codex was unavailable, so the
`reviewer` agent reviewed every slice and the whole branch, and the `ui-reviewer` reviewed the portal
screens.

## Checks

| Check                                         | Result                                                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp check`                                    | 0 errors (warnings pre-existing)                                                                                                                          |
| `vp run guard`                                | all repository rules pass                                                                                                                                 |
| `vp run build`                                | passes                                                                                                                                                    |
| `vp test --run` (full)                        | 1106 passed, 6 skipped, 2 failed: two stale schema lists (`db/assets`, `tax/schema/tax`), fixed with the `0024` snapshot; the affected suites rerun 68/68 |
| Workers suite                                 | 52 passed (14 files), including queue conformance and the edge consumer                                                                                   |
| e2e portal project                            | 257 passed, 5 failed under two workers; all 5 pass alone (7/7 with setup)                                                                                 |
| e2e till-ui (checkout, back-office dashboard) | 45 passed; the earlier timeouts were host load from another session (load average 60–80)                                                                  |

## The Notion tests

- "Receive → sell → count → variance; stock on hand equals the fold of movements"
  (`tests/integration/stock/ledger.test.ts`). A goods-received note at 08:00 and golden sales through
  `/sync/push` give Rice an expected 21 000. A full take counts 20 000 at 14:00, a real sale is pushed at
  14:30, and the 15:00 post keeps the variance at −1 000 and on hand at 19 000. For every product, the
  API's on hand equals the SQL `SUM` of `stock_movement` and the detail's last running balance. The
  audit chain verifies, and a second post is 409. Dating the count at post time instead of `counted_at`
  fails it.
- "Low-stock alert enqueued once, not once per sale" (`tests/integration/stock/alerts.test.ts`). Four
  sales through the real sale path take Rice under its level; one `stock.low` v1 message and one open
  alert. Receiving clears it with no new message; raising the level raises a second. Removing the
  partial-index guard gives three messages; enqueueing before commit fails the rollback test.
- Done when (`tests/e2e/portal/stock/take.spec.ts`, "The inventory manager runs a stock take from the
  portal"): an inventory-role member, keyboard only, starts a full take, counts every line, reviews a
  −1 variance and posts it; on hand updates.

## Browser

Portal Inventory screens verified with playwright-cli at 1920, 1440, 1366, 768 and 390 in every state
(populated, empty, error, offline, no permission), with the keyboard path, the console, overflow and the
skeleton audit. Screenshots: `docs/plans/day16/screenshots/portal/`. Figma has no inventory frames; the
screens follow 45:852 ("Previous purchases", "Purchase #10482") and the 227:4900 tab pattern.

## Not checked

No deployment, no real Arkesel send (the fake covers the contract; the reply shape `{status: "success"}`
is not confirmed in Arkesel's public docs), no Cloudflare queue in a live account.
