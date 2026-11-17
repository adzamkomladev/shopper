# Day 44 plan · Migration wizards + round trip

Branch `day44-migration-wizards` off `main` (`bfdd8d31`, Day 43 and the paused workflows merged). All data is
disposable: wipe local Postgres, Rivet, RustFS and `.shopper/` whenever that is simpler. No subagents: the planner,
test-author, implementer, ui-builder and reviewer roles run inline with their skills (`feature-plan`, `tdd-slice`,
`ui-screen`, `ui-verify` + `playwright-cli`, `pre-merge-review`). This file is the first commit.

## Context

Notion row **44 · Migration wizards + round-trip** (Phase 7, P0, Migration/Portal). **Milestone:** cloud → box → cloud
round trip identical. Tasks: portal wizards _Move to on-premise_ / _Move to cloud_ with pre-flight checks, dry run,
cutover window and rollback; migration runbooks for both directions. Required test: **round trip cloud → box → cloud:
every table, blob and audit chain identical; audit chain still verifies.**

What exists on `main`:

- **Day 42 (box → cloud):** `openImport` / `receiveFile` / `commitImport` / `runArchiveImport` / `importArchive`, the
  box's `cloud_move` row and `CloudMove` workflow, `reloc/1` relocation. The box screen _Move to cloud_
  (`screens/migration/move`) with a checklist, a confirm dialog and progress. A failure before commit reopens the box.
- **Day 43 (cloud → box):** `box_move` (`open → claimed → archived | cancelled`), the licence issued from the box's
  request code, `arriveFromCloud`, `reconciliationReport` + `compareReports`, the cloud screen _Move on-prem_
  (`screens/migration/onprem`) with steps, _Call the move off_ and the report.

## The gap the round trip finds

After cloud → box the cloud still holds the org, archived for good. The way back refuses it:
`openImport` answers 409 "This shop is already in the cloud." and `importArchive` replays as a no-op once the org
exists. So today the round trip cannot be done at all. The fix is the core of the day.

## Decisions (defaults; say if you want otherwise)

1. **The way back replaces the archived copy.** The cloud accepts a box moving in when it holds that org only as an
   archived departure (`box_move.status = 'archived'`). Any other existing org is still 409. The import deletes every
   row of the stale org (reverse foreign-key order, `tableOrder` reused), then writes the archive, in the one import
   transaction. A failure leaves the archived copy untouched. The `box_move` row goes with it, so the org is no longer
   frozen and the watchdog picks it up again. The deleted cloud rows are a strict prefix of what the box sends back
   (the box's audit chain continues the cloud's), so nothing is lost.
2. **Append-only stays append-only, except for that one delete.** Migration `0046_replace.sql` redefines the only two
   guard functions (`shopper_reject_history_change`, `shopper_preserve_sale`) to let a `DELETE` through when the
   transaction-local `shopper.replace` equals the row's `org_id`. Updates are still refused, and a row of any other
   org is still refused. No `session_replication_role`, no table locks.
3. **Pre-flight is warnings, not gates.** Both move views gain `checks`: the shop looks closed (no sale in the last 15
   minutes), every register reached the server in the last 24 hours, no shift is open, and a dry run sealed and
   verified in the last 24 hours. Each check names what it found. The owner can still start: a till that is off keeps
   its sales in its outbox and they follow the move. Already-moving stays the only hard refusal (unchanged).
4. **Dry run = seal and verify, no freeze.** `POST /migration/dryrun` (both runtimes, `migration.run`) seals a Day 41
   archive with the existing Workflow; `GET /migration/dryrun/:id` reads it back through `verifyArchive` and answers
   rows, files, bytes, the verdict and the estimated cutover window. Nothing is frozen and nothing is sent anywhere.
5. **Cutover window = an estimate the owner reads before starting**, from the dry run's size (`shortcut:` a fixed
   throughput guess; measure on the pilot box), shown with the "shop looks closed" check. Scheduling a move for later
   is not built: it would need a waiting Workflow on both runtimes for a button the owner can press at closing time.
6. **Rollback is what each stage already allows, made visible.** Cloud → box: _Call the move off_ while open or
   claimed (exists); after it is archived, rollback is moving back to the cloud, which decision 1 makes possible.
   Box → cloud: any failure before the commit reopens the box (exists); after the commit there is no rollback
   (Day 42 limit, unchanged). The wizard says which applies at each stage, and the runbooks spell it out.
7. **One shared wizard panel.** `components/migration/preflight.tsx` (checks + dry run + window) is used by both
   cards, so the two wizards read the same.

## Slices (tests first, one commit each)

| #   | Slice                                                                                                       | Tests (written first)                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Round trip: `0046_replace.sql`, `replaceOrg` in `importArchive`, `openImport` accepts an archived departure | `migration/roundtrip.test.ts` (required): cloud → box → cloud; every table's rows and checksum, every blob's bytes and the audit chain identical to the box at departure; `verifyChain` passes; the org is writable again. Plus: a live (non-archived) cloud org is still 409; an `audit_log` delete without the setting still fails |
| S2  | Pre-flight checks + dry run API                                                                             | `migration/preflight.test.ts`: checks flip with a recent sale, a stale register, an open shift and a dry run; dry run seals without freezing (a member write still succeeds), verifies, estimates; tenant sweep body for `POST /migration/dryrun`                                                                                    |
| S3  | Wizards: shared preflight panel in _Move on-prem_ and _Move to cloud_, rollback copy per stage              | e2e: the onprem and move specs see the checks, run a dry run and see its verdict; `ui-verify` at desktop, laptop, tablet, mobile, till                                                                                                                                                                                               |
| S4  | Runbooks + docs                                                                                             | `docs/runbooks/migration/{box,cloud}.md`, `migration.md` round-trip section                                                                                                                                                                                                                                                          |
| S5  | Review + verification                                                                                       | `pre-merge-review` (Codex), `docs/plans/day44/verification.md`                                                                                                                                                                                                                                                                       |

## Checks

`vp check`, `vp run guard`, the migration and export suites, the security sweep, the e2e specs touched, then the full
`vp test --run` before the push. PR, CI to green, merge, then Notion row 44 updated with remarks.
