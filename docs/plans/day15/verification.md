# Day 15 verification

Run on 19–20 Oct 2026 on the Ubuntu dev box, branch `day15-shifts-cash`.

## Checks

| Check                   | Result                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp check`              | 0 errors (10 warnings, all pre-existing)                                                                                                                |
| `vp run guard`          | all repository rules pass                                                                                                                               |
| `vp run build`          | passes                                                                                                                                                  |
| `vp test --run` (alone) | 1059 passed, 6 skipped, 1 failed: workerd `pull.test.ts` timed out under load; passes alone                                                             |
| `vp run e2e` (full)     | first run 584 passed / 8 failed, all timeouts; second run 591 passed / 1 failed (`users/members.spec.ts` click timeout); every failed spec passes alone |

Host-process suites share one `apps/till/host/dist` build; two suites started at once race on it
(`ENOTEMPTY`/missing `server.js`). Run them one at a time.

## The Notion tests

- "Shift with sales, refunds, drops and a no-sale → Z-report reconciles to the cedi"
  (`tests/integration/till/shifts/close.test.ts`): GHS 200 float, cash and card sales and refunds with
  10p rounding on a sale and a refund, a GHS 100 drop and a no-sale. Expected cash 1 036 000 and card
  12 000, worked by hand in the test; every variance 0; an earlier shift's sale excluded; the audit chain
  verifies and the Z anchor equals the chain head before the close row.
- "Declared vs expected variance computed correctly per tender"
  (`tests/integration/till/shifts/variance.test.ts`): cash −3 000, card +10 000, MoMo 0; exactly the
  threshold closes alone, one pesewa over is `APPROVAL_REQUIRED`, an approver closes it with
  `approver_id` set.

## Browser

- Till shift screens: `ui-verify` at 1920×1080, 1440×900, 1366×768, 768×1024 and 390×844 for every state
  and the keyboard path, no overflow, no serious axe findings, no console errors from this change; a
  `ui-reviewer` pass with its findings fixed. Screenshots: [screenshots/till](screenshots/till).
- Portal Shifts list and detail: the same five sizes, skeleton layout shift 0, a `ui-reviewer` pass with
  its findings fixed. Screenshots: [screenshots/portal](screenshots/portal).
- The till e2e `live.spec.ts` drives a real register host end to end: closed register, customer display
  "Register closed", open with a counted float, X, blind close, Z, display closed again.

## Not verified

- The manual walk on the physical dev till and virtual printer was covered by the host integration
  suites and the live e2e spec rather than by hand.
- Figma has no shift frames; screens were composed from Register closed, Sales Reports and Review
  refund. Menu drawer and Settings · Register were followed through the existing code patterns.
