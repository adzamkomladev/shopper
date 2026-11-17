# Day 44 verification · Migration wizards + round trip

Branch `day44-migration-wizards`. Milestone: **cloud → box → cloud round trip identical**.

## What shipped

| Slice  | Commit subject                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------ |
| Plan   | Day 44 plan: migration wizards and the round trip                                                |
| S1     | A shop that moved onto its box can move back to the cloud (`0046_replace.sql`, replacing import) |
| S2     | Pre-flight checks and a dry run for both move directions                                         |
| S3     | Both move wizards open with pre-flight checks and a dry run                                      |
| S4     | Migration runbooks for both directions                                                           |
| Review | A twice-moved shop comes back, and dry runs stay in memory budget                                |

## Tests (written first, watched failing)

- `migration/roundtrip.test.ts` (required). Failed first with "This shop is already in the cloud." It also covers a
  live cloud org still being refused (409) and history staying append-only without `shopper.replace`, and refusing
  another org's id. After the review it plants an earlier finished import, which failed with "This import is no
  longer uploading." before the fix.
- `migration/preflight.test.ts`: the shop-closed check at 5 and 15 minutes, the dry run sealing with nothing frozen,
  its verdict, a stale dry run after a day, a damaged part, an unknown id (404), and a cashier refused (403).
- `migration/onprem.cutover.test.ts` now drives its cloud → box leg through the shared `toBox()` harness.
- E2E `tests/e2e/portal/migration/{onprem,move}.spec.ts`: 16/16, including three new specs (dry run passed and failed
  in the cloud, dry run on the box via `D`). Screenshots at 1920, 1440, 1366, 768 and 390 in `test-results/day44/`.

## Checks

- `vp check`, `vp lint`, `vp run guard`: clean.
- Migration, export, tenant sweep, db, audit and release suites: green.
- Full `vp test --run`: see the PR's CI.

## Review

Codex `gpt-6.1-sol` (medium) on `--base main`: two findings, both confirmed and fixed test-first (P1 returning shop
with an earlier `ready` import; P2 dry run buffering the whole ZIP). The re-review of the fix commit found nothing.

## Not done or not run

- Scheduling a cutover for later (would need a waiting Workflow on both runtimes); the window is an estimate.
- `cutoverMinutes` is a guess (2 min + 1 per 10 MB) until a pilot move is measured.
- No "registers synced" or "shifts open" check: the server has no last-contact time per register and only sees
  closed shifts.
- The cloud's own audit rows written after sealing (licence, claim, verdict) are replaced on the way back; the
  import's audit row keeps their head as `replaced`.
- The round trip runs in process (both APIs and both databases); no real box hardware, deployment or Worker.
- Figma has no migration frames; the panel follows the file's bordered list rows (Quick Actions).
