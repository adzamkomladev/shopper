# Day 15 progress

- **Plan:** [plan.md](plan.md). **Verification:** [verification.md](verification.md).
- **Branch:** `day15-shifts-cash`, cut from `origin/main` at `c7809ac`.
- **Commits:** one local commit per slice; the branch is pushed once, at the end.
- **Review:** Codex was unavailable, so every slice was reviewed by the `reviewer` agent (UI slices
  also by `ui-reviewer`), each confirmed finding was fixed before the slice was committed, and a
  whole-branch pass ran at the end.

## Status

| Slice                                                         | Commit    | State |
| ------------------------------------------------------------- | --------- | ----- |
| 0 Plan                                                        | `20919a0` | done  |
| 1 Shift storage (till step 8), open shift and the sale guard  | `ab4e0cc` | done  |
| 2 Cash drops, no-sale and the X-report                        | `8058885` | done  |
| 3 Blind close, variance per tender, the Z and `shift.approve` | `bebb97f` | done  |
| 4 X and Z printout with the audit anchor                      | `b27ebc5` | done  |
| 5 Shift upload and server acceptance (0023)                   | `9a1b6db` | done  |
| 6 Till host shift bridge                                      | `7ca3e51` | done  |
| 7 Shifts API for the back office                              | `0a035b8` | done  |
| 8 Till shift screens                                          | `0da0401` | done  |
| 9 Back-office Shifts screen                                   | `375d526` | done  |
| Whole-branch review fixes                                     | `458d0bd` | done  |
| 10 Docs, verification, PR                                     | this one  | done  |

## The Notion tests

| Test                                                                             | Where                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------ |
| Shift with sales, refunds, drops and a no-sale → Z-report reconciles to the cedi | `tests/integration/till/shifts/close.test.ts`    |
| Declared vs expected variance computed correctly per tender                      | `tests/integration/till/shifts/variance.test.ts` |

## Bugs found by review and fixed

- **A MoMo confirmation could be lost after the count.** The shift guard ran on every payment update;
  it now runs only when a payment starts, so money already taken always lands.
- **A null no-sale reason passed the till CHECK** (`length(trim(NULL))` is NULL). Fixed with `coalesce`.
- **The variance threshold could change between count and close.** It is now fixed at the count.
- **A malformed Z became a 500 and retried forever.** Negative amounts and bad movements are now a
  terminal `SHIFT_MISMATCH`.
- **The 58 mm printout cut digits off wide figures.** A too-wide tender row now prints one figure per line.
- **`/shifts` was served by the public API (404) on both hosts.** Added to the authenticated paths.
- **Stale status after a failed declare-and-close, and an approver-name lookup that could fail a printed close.**
- **The portal variance badge used the net**, so a cash shortage offset by card over read "Balanced". The
  API now returns `short` and `over`, and any shortage reads "Short".
- **Till UI:** shell keys stayed live under a shift dialog; an in-flight report could leak into the next
  cashier's state; numpad Enter submitted a partial count; an empty count could open or close a shift;
  Print X stayed enabled offline; Alt+X could print the X during the blind count.

## Upgrade notes

- PG migration `0023_shifts` (tables `shift`, `shift_tender`, `shift_movement`).
- Till SQLite step 8 (`shift`, `shift_movement`, `shift_id` on `local_sale` and `refund`).
- New permission `shift.approve`: re-seed roles so owners and admins hold it and tills receive it.
- Reset dev data (`vp run db:reset`, migrate, seed) and re-provision tills; every register starts closed.

## Known limits

- The server trusts the till's sale and refund totals, the threshold and the approver's presence until
  the Day 20 cross-check. A closer holding `shift.approve` can approve their own variance.
- Open shifts don't appear in the portal. An unclosed shift spans days until the store-day workflow.
- The threshold is a till-only setting.
- A counted shift over the threshold waits for a manager. After an offline sign-in with an expired
  stored session the host strips `shift.write`, so the close waits until the host is online.
- The Settings drawer test is now an audited no-sale, so it needs `register.settings` and `shift.write`
  and an open shift.

## Left out

The store-day workflow and forced end-of-day close; publishing the Day 20 anchor; a Z PDF; GRA Z
submission; pay-in and pay-out, safe and bank reconciliation; recounts and a blind float; the server
cross-check of the Z against its sales.
