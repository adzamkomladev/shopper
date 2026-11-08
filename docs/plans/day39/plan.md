# Day 39 plan · Box failure drills

Branch `day39-box-drills` off `main` (38e7a2f, Day 38 merged as PR #55). Data is disposable: local Postgres, the Rivet
volume, RustFS buckets, `.shopper/` and machine containers may be wiped whenever that is simpler.

## Context

Notion row **39 · Box failure drills** (Phase 6, P0, surfaces Box + Sync). **Done when: in every drill, no till stops
selling.** Every drill below asserts that with one shared helper: during and after the fault, a till rings a sale that
completes locally (receipt number issued, drawer event written), and after recovery the sale is on the box exactly once.

What the code has today (checked, not assumed):

- Till chaos (Day 24) proves the till survives _its own_ death against an in-process API
  (`tests/integration/sync/chaos/*`, `tests/support/till/host/*`). Nobody has killed the **box** under a till yet.
- `startSealed` (`tests/support/box/sealed.ts`) runs the sealed binary as a child process; `createHostFixture` takes any
  `upstream` URL. Together they give a real till host against a real box process with no new harness.
- The Rivet engine in tests is the shared compose/CI service, so it cannot be killed without breaking other suites.
  The systemd units have `Restart=always`, `RestartSec=2` but nothing proves the engine comes back with state intact.
- **Restore gap (real bug, found by reading):** the till deletes its outbox row on ack (`push/storage.ts`) and keeps
  only `local_sale`. After a box is restored from last night's backup, sales acked since the backup exist nowhere on the
  box and nothing re-sends them. The pull worker also halts as `incompatible` when the box head is below the till's
  cursor (`pull/worker.ts` `ordered`). Receipt blocks issued after the backup can be issued again to another till.
- Fiscal: the box lane retries with backoff and a pull re-hands stranded documents (`STRANDED_AFTER_MS`). A 48 h
  outage has never been run; the backoff ceiling and the stranded sweep over 48 h are untested.
- Licence ladder (Day 37) is tested at single points (`licence/readonly.test.ts`), not walked end to end with a till.
- Updates (Day 38): `shopper-apply` switches slots and back, but on a rollback it only **tells** the owner to restore the
  backup by hand, and the reason is a fixed sentence. The pre-update backup is encrypted to Shopper's age recipient, so
  the box cannot restore it itself.
- Tills take updates only from the build-time cloud feed (`buildInfo.tillUpdateUrl`); a box LAN has no route to it.
- Tax rule packs: `updateVerdict` accepts `kind: "taxpack"`, but `prepare()` refuses it ("applied by the tax module")
  and no code applies one.

| Notion drill                                                 | Slice | Expected work beyond the test                                                     |
| ------------------------------------------------------------ | ----- | --------------------------------------------------------------------------------- |
| Kill the box mid-trade → tills keep selling, catch up after  | S1    | Probably none (proves the Day 24 till against a real box process)                 |
| Kill the Rivet engine mid-batch → restarts, state intact     | S2    | Probably none; machine check of the systemd restart                               |
| Restore last night's backup to a spare box → tills replay    | S3    | Till replay on box regression, pull re-snapshot, receipt block adoption, runbook  |
| LTE/egress down 48 h → fiscal queue drains on return         | S4    | Whatever the 48 h run exposes (backoff ceiling, stranded sweep)                   |
| Licence expiry ladder end to end                             | S5    | Probably none                                                                     |
| Upgrade 1.0.0 → 1.0.1; tills then update from the box        | S6    | Box serves the till feed from the running slot; handshake hands the till the feed |
| Failing migration → auto rollback + pre-upgrade backup + why | S7    | Boot failure reason file; local pre-update dump; `shopper-apply` restores it      |
| Lapsed maintenance: sells, update refused, tax pack accepted | S8    | Apply a signed tax rule pack (command + audit), Updates card action               |

## Decisions (defaults; say if you want otherwise)

1. **Two layers.** Fast integration drills (every PR) for the logic; the systemd `machine` project (Day 38 harness,
   `--network none` Ubuntu with systemd) only for what needs a real init system: engine and box restarts by systemd,
   the update/rollback/restore flow. No new CI job.
2. **Till replay after a restore = a per-device watermark, not an epoch.** The handshake answers
   `lastAccepted: <highest localId the box holds from this device>` (UUIDv7, so ordered). A till re-queues every
   `local_sale` above it that is not already queued, with its original localId, receipt number and occurredAt, so
   acceptance stays idempotent. Self-healing for any loss, no restore flag, no migration. Same rule for whatever other
   upload kinds the outbox carries that keep a local row (checked in S3; anything that does not is named).
3. **Pull after a restore:** box head below the till's cursor → the till takes a fresh snapshot instead of halting.
4. **Receipt blocks after a restore:** the handshake already sends `receiptLastUsed`; the box adopts a block the till
   reports but the box no longer has, so it is never issued twice.
5. **Restore is a support runbook**, not a new subcommand: support decrypts with Shopper's age identity (the box never
   holds it) and runs the documented `pg_restore`; the spare box starts with an empty engine. The drill runs exactly
   the runbook's commands.
6. **Automatic rollback restores the database** from a **local, unencrypted pre-update dump** (`pg_dump -Fc`, mode 600,
   owned by `shopper`, in `/var/lib/shopper/updates/`), written in the same snapshot as the verified remote backup and
   deleted after a healthy update. `shopper-apply` restores it only when the migration journal moved; Drizzle runs all
   pending migrations in one transaction, so a migration that fails leaves the journal unchanged and only the binary
   rolls back. No new exposure: the live database sits on the same disk unencrypted.
7. **Rollback reason:** the box writes its fatal start error to `updates/boot-error.txt` before exiting; `shopper-apply`
   puts it in `result.json` and the Updates card shows it.
8. **Till feed from the box:** an update bundle may carry `till/<channel>/latest.yml` + installer, signed in the same
   manifest. The box serves `/till/updates/<channel>/` from the running slot; the handshake returns `updateFeed` (the
   box's own origin; `null` on cloud, which keeps the build feed). `createUpdates` uses the policy's feed when set.
9. **Tax pack apply:** `taxpack` bundles carry `taxrules.json`; `tax.pack.apply` (`defineCommand`, audited) inserts the
   rules by effective date, idempotent by pack version (recorded in `shopper_meta`, no migration). Tills get the rules
   through the existing pull. Permission: the existing `billing.manage` that guards updates, as data.

Out of scope (named): a `shopper-box restore` subcommand, an engine-state restore (the engine is not the record),
real Windows tills on the LAN (Day 40), real R2, real VM and real mDNS, delta updates, a drill dashboard.

## How I work (per your instructions)

No subagents: the `planner`, `test-author`, `implementer`, `ui-builder`, `ui-reviewer` and `reviewer` roles are done
inline with the skills `feature-plan`, `tdd-slice`, `cloud-box-parity`, `ui-screen`, `ui-verify`, `skeleton-audit`,
`pre-merge-review`, `playwright-cli`. Per slice: failing test first, break-check (break the fix once, watch it fail),
implement, run the slice's tests, `vp check`, `vp run guard`, commit. Context7 for Bun / Drizzle / electron-updater
questions. Before push: `codex review` on `gpt-6.1-sol` (per commit if the branch diff is too large, as Day 38). Push
once, PR, bind with `ccd_pr`, watch CI and auto-fix until green, merge, update the Notion row (ticks, Status Done,
Progress, Remarks). Figma: the MCP seat hit its rate limit on the first call today; the supplied frames are the POS
Dashboard page with no update or tax-pack frame, so UI reuses the Updates card, alert and badge patterns, recorded in
the verification file.

Shared helper first: `tests/support/box/drill.ts` — `boxWithTill()` (sealed box process + till host fixture on the box
URL, its own pool) and `expectStillSelling(host)` (rings one sale, asserts a local receipt number).

## S1 · Kill the box mid-trade

`tests/integration/box/drills/kill.test.ts`: two tills on a sealed box; while both push a 100-sale backlog, `SIGKILL`
the box; each till keeps selling (`expectStillSelling` × 5 while the box is down); restart the box on the same
database; both drain; `expectConverged` on both; store sequences have no repeat; every receipt number is unique per
store. Break-check: make the box ack before commit (one-line revert) and watch convergence fail.

## S2 · Kill the Rivet engine mid-batch

`tests/integration/box/drills/engine.test.ts` (Docker; skipped without it, runs in CI): a private
`rivetdev/engine:3.0.0-preview.3` container with `--restart=always`; a sealed box on it; a till pushing a 200-sale
batch; `docker exec <engine> kill -9 1` mid-batch; the container comes back; the till keeps selling throughout; the
batch drains; sale rows, store sequences, `workflow_run` and audit chains in Postgres are intact (counts match the
till, sequences contiguous, audit chain verifies). Machine test addition: `systemctl kill -s KILL shopper-engine` and
`shopper-box` each → `is-active` again within 10 s and `/api/health/ready` answers.

## S3 · Restore last night's backup to a spare box

`tests/integration/box/drills/restore.test.ts`: box A sells (two tills); `backupBox` runs ("last night"); tills sell 50
more and drain; box A is destroyed; a spare box B is created by the runbook (decrypt, `pg_restore` into a fresh
database, fresh engine pool); tills are pointed at B. Asserts: tills keep selling on B immediately; the 50 sales reach B
by replay, each exactly once with its original receipt number; B issues no receipt block that overlaps a till's;
both tills' pulls re-snapshot and converge; the ledger and fiscal queue on B include the replayed sales. Break-checks:
removing the watermark loses the 50; removing block adoption gives a duplicate receipt number. Work: handshake
`lastAccepted`, till re-queue (`packages/sync/src/push`), pull re-snapshot, block adoption in `issueReceiptBlocks`,
protocol schema + sync `v` bump with upcaster if the handshake shape needs it, runbook in `deployment.md`.

## S4 · Egress down for 48 hours

`tests/integration/box/drills/egress.test.ts`: box lane with the SDC fake reachable only through the box egress guard;
the SDC host is dropped from the allowlist (egress refused, as an LTE outage looks to the box); the clock advances
48 h in steps while tills sell 200 sales across that time; every sale is accepted at once and every document waits
`pending`; the allowlist comes back; the lane drains all 200 in store order within one wake cycle, each signed once,
and the signatures reach the tills on the feed. Fix whatever the 48 h exposes (backoff ceiling, stranded sweep age).

## S5 · Licence expiry ladder end to end

`tests/integration/box/drills/licence.test.ts`: one box, one till, clock walked through day 0, 29, 30, 59, 60, then a
check-in: the banner state at each step, back-office writes refused (402) from day 60, reads allowed, the till sells at
every step, a check-in restores writes; a forged licence locks at once and the till still sells.

## S6 · Upgrade 1.0.0 → 1.0.1; tills update from the box

Integration `tests/integration/box/drills/tillfeed.test.ts`: a box running a slot that carries `till/stable/latest.yml`
serves it at `/till/updates/stable/latest.yml` (and the installer, with the signed hash); a path outside the slot is
404; the handshake on the box returns `updateFeed`, on the cloud `null`; `createUpdates` sets the generic feed to the
box when the policy carries one. Machine test: the installer is built as 1.0.0, the update bundle as 1.0.1 with a till
feed; after Install now the box reports 1.0.1 and the feed answers 1.0.1.

## S7 · Failing migration → automatic rollback

Integration `tests/integration/box/apply.test.ts` (extend, fake `systemctl`): unhealthy new slot with an unchanged
journal → binary rolled back, database untouched, reason from `boot-error.txt` in `result.json`; unhealthy with a
moved journal → pre-update dump restored, journal back to the old count, `result.json` says so; healthy → local dump
deleted. Machine test: a signed 1.0.2 bundle whose extra migration fails (`select 1/0`) → `rolled_back`, running slot
unchanged, journal count unchanged, message names the migration and "division by zero", a till sale goes through.
UI: the Updates card shows the reason and whether the database was restored. Break-check: skip the restore branch.

## S8 · Lapsed maintenance and tax packs

`tests/integration/box/drills/maintenance.test.ts`: licence with `maintenanceUntil` in the past; the till sells; an
update bundle built after it is refused with both dates; a tax pack built after it is applied: rules inserted by
effective date, one audit row, a second apply is a no-op, a sale after the effective date snapshots the new rate on
the box and on the till after pull. UI e2e (`tests/e2e/portal/updates/updates.spec.ts`, extend): tax pack row with
**Apply tax rules**, confirmation, applied state, already-applied state, refusal. `ui-verify` at 1920×1080, 1440×900,
1366×768, 768×1024, 390×844 and till size; axe and overflow at each; keyboard path.

## S9 · Docs, review, ship

Docs: `deployment.md` (restore runbook, local pre-update dump, rollback with restore, tax packs, till feed from the
box), `platforms.md` (drill matrix), `security.md` (pre-update dump file mode, tax pack signing), `apps/box/README.md`,
`docs/plans/day39/verification.md` (what each drill proved and what was not exercised). Codex review, PR, CI green,
merge, Notion.

## Risks

- **S3 is the real work** and touches the sync protocol; if the handshake shape changes, every till build needs the
  upcaster. It goes first after S1 so the rest of the day absorbs any overrun.
- **S2 depends on the engine coming back with its own state** inside a restarted container; if preview.3 loses actor
  state on `kill -9`, the drill proves the box re-derives from Postgres instead, and the remark says so.
- **Machine tests are slow** (≈6 min per install). S6 and S7 extend the existing machine rather than adding a second.
- Not exercised today: real hardware, Windows tills, real LTE, real R2, real VM, mDNS.
