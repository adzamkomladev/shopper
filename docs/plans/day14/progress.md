# Day 14 progress and verification

- **Plan:** [plan.md](plan.md).
- **Branch:** `day14-refunds-overrides`, cut from `origin/main` at `62cb305`.
- **Commits:** one local commit per slice; the branch is pushed once, at the end.
- **Review:** Codex was unavailable, so every slice was reviewed by the `reviewer` agent, and each confirmed finding was fixed in its own commit.

## Status

| Slice                                                   | Commit    | State |
| ------------------------------------------------------- | --------- | ----- |
| Plan                                                    | `6225d90` | done  |
| 1 Manager approvals and approver sync                   | `a0b888c` | done  |
| 2 Approved price overrides, sale event v4, protocol 4   | `2c973d8` | done  |
| 3 Manager approval for voids after tender               | `e6bdd89` | done  |
| Review fixes: PIN lockout race, cross-org isolation     | `f6435e9` | done  |
| Review fixes: override audit map, host tests, scope check | `8fad995` | done  |
| 4 Final-sale products (migration 0021, feed v3)         | `3f6ed7a` | done  |
| 5 Server refunds with snapshot tax reversal (0022)      | `6f5656a` | done  |
| 7 Approval, void and price override screens             | `ac9db3d` | done  |
| 6 Till refunds, refund receipts, shared upload lane     | `370cb03` | done  |
| 8 Returns screens and held-sale void approval           | `9dbce2a` | done  |
| Review fixes: final sale on server, retry id, receipt upcast, rounding | `0e40778` | done |

Slice 7 ran before slice 6 because it only needed the approval backend.

## The Notion tests

| Test | Where |
| --- | --- |
| Partial refund reverses exactly the refunded lines' tax | `tests/integration/sales/refunds/tax.test.ts` |
| Override without manager PIN is refused; with PIN, audit shows both actor and approver | `tests/integration/till/basket/drafts/override.test.ts` |

## Bugs found by review and fixed

- **Parallel PIN guesses got past the lock.** Parallel wrong PINs all read the same attempt count, so the 5-try lock never tripped. Guesses for one approver now run one at a time.
- **No cross-org check on approvers.** No test proved another org's manager stays off this till's approver list. One now does.
- **Overrides with several approvers lost their approvers in the audit.** The full per-line approver map is now recorded.
- **Core skipped the session's scope and expiry when an approver was given.** It now always checks them.
- **The server never checked the final-sale flag.** It now rejects final-sale lines itself, instead of trusting the till.
- **A lost reply after the server accepted could lead to a double refund on retry.** The refund id is now stable across retries, so the server replays the first refund.
- **Receipt document v2 rejected stored v1 receipts.** v1 receipts are now upcast on read.
- **Cash rounding could reject a refund after the cash was paid.** Cumulative rounding differs between registers, so the server now accepts any signed rounding up to 5 pesewas.
- **A test would have failed from October 2027.** Its fixed date is replaced by a frozen clock.

## Verification

- **Tests first:** every slice recorded a red run before its implementation. Slice 1 is the exception: its tests were written alongside the code, and the review-fix commit that followed added red-first tests for the lockout race.
- **Integration and checks:** the full integration suite, `vp check` and `vp run guard` run once at the end. The results are below.
- **E2E:** each touched spec ran on its own with `--workers=1`, because the server is shared:
  - till sale: approval, approval/held, held, focus, tender, receipt, live, transitions, keyboard, states, momo, print, ordering, connection;
  - till purchases: return, return/states, lookup, screen, reprint, live, recovery;
  - settings, shell;
  - portal catalogue.

  The complete e2e run is left to CI.
- **UI checks** (`/ui-verify` with `playwright-cli`): desktop 1920×1080, laptop 1440×900, tablet 768×1024, mobile 390×844 and till 1366×768, with no horizontal overflow anywhere.
  - Screenshots: [screenshots/approvals](screenshots/approvals) and [screenshots/returns](screenshots/returns).
  - The only console error is the harness's existing `/session/permissions` shape warning.
- **Figma:**
  - The list and detail screens follow 55:2263 and 55:3230.
  - There are no frames for the return step, PIN fields or price override, so those were composed from the existing till dialogs. Figma was not edited.
  - Left out: Figma's date picker, Export CSV, Customer, Items and Cashier columns, and "Policy RET-30".
  - "Return eligible" uses a green icon with foreground text, because Figma's green-700 on its tint fails contrast.

## Known limits

- An offline refund on one till and an online refund of the same line on another can both pay out. One is then blocked at upload and shown in sync status.
- The server checks an approver's current grant at upload. A manager demoted before an offline sale or refund syncs makes it blocked.
- The server cannot prove a PIN was typed.
- A revoked manager can approve offline for up to 7 days.
- The return window and `requirePinForReturns` are enforced on the till only.
- The host keeps the retry plan for a lost refund reply in memory. After a host restart, the retry is refused and the shop sees the refund on the server.
- The refund preview shows the lines' gross. The cash payout can differ by under 10 pesewas; the toast and receipt show the real amount.
- A refund receipt has no number of its own. GRA credit notes come with E-VAT.
- Sale event v4, sync protocol 4, feed v3 and receipt v2 have no upcaster for synced events, so tills must be drained or reset before upgrading. Stored receipts are upcast.
- The new `sale.price_override` permission reaches an existing org only when its roles are re-seeded. Reset and re-seed (`vp run db:reset`).
- The Notion catch-up item still covers the Day 13 device steps, which wait for the hardware.
