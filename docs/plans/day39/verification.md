# Day 39 verification: box failure drills

Every drill causes the failure for real (SIGKILL, `kill -9` on the engine's host PID, `pg_restore` onto a spare,
an SDC that is down, a box that fails to start) and asserts on PostgreSQL, the register's SQLite and the receipts.

## What each drill proved

| Slice   | Drill                                     | Result                                                                                                                                                                                                                                                     | Break-check                                  |
| ------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| S1      | Box SIGKILLed mid-trade, two registers    | 130 sales, each once; registers never stopped                                                                                                                                                                                                              | Box acking before commit → convergence fails |
| S2      | Rivet engine `kill -9` mid-batch          | Engine restarted (`RestartCount ≥ 1`), 85 sales whole, `doctor` runs a workflow on Rivet                                                                                                                                                                   | — (no product change)                        |
| S3      | Spare box restored from last night's dump | **Bug found**: acknowledged sales after the dump were lost (22 of 52). Fixed: handshake reports `held`, registers replay (`till.sync.replay`). Every sale once with its receipt number and hash; no receipt number or store sequence twice; pulls converge | Replay disabled → 22 vs 52                   |
| S4      | LTE down 48 h (60 lane wakes)             | **Bug found**: documents dead-lettered after 10 unreachable tries. Fixed: only a reply from the SDC counts (`SdcUnavailable.reached`). All 12 signed in order on return; a 503-replying SDC still dead-letters                                             | Counting unreached tries → dead              |
| S5      | Licence ladder day 0/29/30/59/60, forged  | valid / grace / locked; writes 201 → 402; a register's push accepted at every step                                                                                                                                                                         | Grace moved to day 31 → fails                |
| S6      | Registers update from the box             | Handshake carries `updateFeed` on the box only; box serves `till/<channel>/<file>`; traversal and unknown channel refused; updater downloads from it                                                                                                       | —                                            |
| S7      | Update fails after a migration            | Reason from `boot-error.txt` in the result; dump restored into a fresh database, changed one kept as `_failed_`; unchanged → dump dropped; no dump → said so                                                                                               | Restore branch skipped → rollback test fails |
| S8      | Tax rule pack on a lapsed licence         | Update refused with the maintenance message; pack applies (1 rule), reapply changes 0, forged rules refused, a rule already in force refuses the pack                                                                                                      | Idempotency skip removed → fails             |
| Machine | Real Ubuntu + systemd                     | `systemctl kill -s KILL` on engine and box → both back and ready; broken bundle that records a migration and dies → slot switched back, database restored, reason shown; till feed through Caddy                                                           | —                                            |

## UI

Billing → Updates: a tax rule pack row has **Apply tax rules** behind a confirmation (no restart, never scheduled); the
toast says how many rules changed. A rolled-back result shows the box's reason and what was done to the database
(the card already rendered `last.message`). e2e: `tests/e2e/portal/updates/updates.spec.ts` (5 tests, keyboard path, screenshots at 1920/1440/1366/768/390 in `screenshots/`).

The Figma MCP answered with a rate limit for the View seat, so the frames were not read; the change reuses the card's
existing row, button and AlertDialog patterns.

## Codex review (gpt-6.1-sol) findings

- **Fixed**: a register that sold into a receipt block issued after the backup was refused at handshake ("Invalid
  receipt cursor") and its sales would be "not issued". The box now re-issues the same 1000-wide blocks up to the
  register's cursor (at most 10 000 past what it knows). `tests/integration/sync/receipts/blocks.test.ts`, failed first.
- **Fixed**: the register's updater (Electron's network stack) did not trust the pinned box CA, so LAN updates over
  `https://shopper.local` would fail TLS. Its session now accepts a chain that verifies to the pinned CA and names the
  host (`trustsPinned`), never "trust everything". `tests/integration/till/electron/trust.test.ts`.
- **Fixed (second pass)**: the updater's check let a leaf's key sign certificates; every signer in the path must now be
  a CA. A tax pack signed without `taxrules.json` in its file map no longer accepts rules added beside it. The
  confirmation now says a scheduled rule with other rates for the same day is replaced. Each had a test fail first.
- **Resolved (Day 40, security decision: box-signed grant)**: sales made under a cashier session signed in after the
  backup were refused as `INVALID_SESSION` (no `cashier_session` row on the restored box). Options weighed: trust the
  register (rejected), a manager approving each lost session on the box, or a grant the box signs at sign-in with a key
  kept in the database. The owner chose the grant, offline sessions under a lost parent included. The register sends it
  with the proof; the restored box verifies it and records the session once (`cashier.session.restore`). The restore
  drill now signs a cashier in after the dump and proves those sales land once with their receipt numbers (with the
  grant dropped at the device service, 36 of 52 sales landed); `tests/integration/sync/session/restore.test.ts` covers
  online and offline recovery and refuses altered grants, a forged signature and another session's grant.

## Not exercised / limits

- After a restore only sales are replayed. Refunds, shifts, stock counts, customers and account payments the backup
  missed are not (named shortcut in `deployment.md`).
- Replayed sales are re-queued as event version 7.
- The pre-update dump is plain (not age-encrypted) on the box, mode 600, removed after a healthy update or a restore.
- The shared server ran at load 70–105 for most of the day; broad local runs timed out, so targeted files were run
  locally and the full suites in CI.
