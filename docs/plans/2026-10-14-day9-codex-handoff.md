# Day 9 handoff for Codex: finish sync pull, realtime and bootstrap (SYNC GATE)

Implementation outcomes and acceptance evidence are recorded in
[Day 9 verification](2026-10-14-day9-verification.md). This document preserves the original handoff.

You are continuing Day 9 on branch `codex/day9-sync-pull`. Read `AGENTS.md`, `docs/engineering/*` for
each area you touch, and the approved plan `docs/plans/2026-10-14-day9-sync-pull.md` (the source of
truth for design, tests and decisions). This file says what is done, what is left and how to finish.

All data in PostgreSQL, Durable Objects, KV, R2/blobs and till SQLite is disposable. Reset anything
freely; no backfills.

## Done (committed locally, NOT pushed)

| Commit    | Slice | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e9082da` | 1     | `feat: add store change feed`. PG `store_change` (migration 0011, append-only trigger). `recordChanges` and the till projections are in `packages/core/src/changes/{record,project}.ts` (`@shopper/core/changes`). They are wired into product create/update/archive, `setPrice`, `schedulePrice` (writes the upsert, with validFrom/validTo), the publishPrice end phase (writes a delete) and import apply (one call). `publishPrice` moved to `prices/publish.ts`. The start-phase realtime envelope takes a fresh `allocateStoreSequence` (a feed gap, which is fine). Tests: `tests/integration/sync/changes.test.ts`.                                                                                                                                                                               |
| `8b52de5` | 2     | `feat: serve till sync pull`. `GET /sync/changes?cursor=&limit=` is in `packages/api/src/sync/pull.ts`, and `pullChanges` is in `packages/core/src/changes/pull.ts`. Pull reads in one REPEATABLE READ, read-only transaction. It returns the snapshot flag when the cursor is 0, the cursor is past the head, or more than 50k change rows are pending. The till's `createPullWorker` is in `packages/sync/src/pull/{worker,apply}.ts`. It validates the whole page before applying anything, checking both version and ordering, and applies the page in one audited `till.sync.pull`. A poll that brings nothing new writes no audit row. The pull cursor is stored in `till_state.pull_cursor`. Tests: `tests/integration/sync/pull/{server,worker}.test.ts` and `tooling/worker-tests/pull.test.ts`. |

Last full run before the slice 2 review fixes: 287/288 tests passed, check, guard and build clean. The single
failure came from a test run that loaded the code before the fix. After the fix, `tests/integration/sync/pull`
and `tests/integration/till-host` pass 27/27. **First action:** run `vp check`, `vp run guard` and the full
`vp test --run` (it takes about 20 min; run it once, in the background) to confirm a clean baseline.

## Decisions already made with the user (do not re-ask)

- Branch and terminal codes are auto-assigned: `BR01…` per org and `T01…` per branch, using atomic counter
  columns, with unique `(org_id, code)` and `(branch_id, code)`. Owners cannot edit them yet.
- Receipt numbers come in blocks: a till holds 2 blocks of 1,000 numbers, topped up on POST only (handshake and
  push ack). The response re-sends every outstanding block, so a lost response is harmless. If a till runs out
  offline, it uses a separate overflow counter, `BR01-T03-X000001`, and sets `receiptOverflow: true`.
- `occurred_at` is the corrected till time: `deviceTime − clockOffset`, measured at handshake and clamped so it
  is never later than acceptance. Raw `device_time` is kept. Tax and session checks use the same corrected time.
- Box realtime uses the in-process `boxRealtime` hub on day 9, behind a Bun WebSocket on the shared `/sync/live`
  route. The Rivet StoreHub actor arrives on day 36. **Do not add `rivetkit`.** Record the trade-off in
  `platforms.md`. It is in the plan's Decisions section.
- There is no tax-rule save command. Tax rules reach tills through the snapshot. The gate test uses product and
  price changes only.
- Finish: push the branch, open a PR, merge when CI is green, then fast-forward local `main`.

## Remaining slices (each is one local commit, test-first)

3. **`feat: bootstrap tills from snapshots`**
   - `GET /sync/snapshot` builds the snapshot with the shared projection: products, active prices and tax rules
     for the store. It reads them with the max change seq in one REPEATABLE READ transaction, gzips the stream,
     and stores it through the `Blobs` port at `snapshots/<org>/<store>/v1/<maxChangeSeq>.json.gz`. The blob is
     reused when it already exists.
   - Wire Blobs into `serveRuntime` in both shells: `cloudflareBlobs(env.BLOBS)` in
     `apps/edge/src/worker.ts`, and `boxBlobs` in `apps/box/src/app.ts`.
   - The till worker, on `{snapshot:true}`, downloads the snapshot and replaces its reference set and cursor in
     one audited command, then pulls the tail.
   - A store with head 0 should return an empty snapshot, not leave the till stuck. The `snapshot` state must
     clear after bootstrap.
   - Test `tests/integration/sync/snapshot.test.ts`:
     - a new till bootstraps;
     - more than 50k pending changes triggers a snapshot;
     - snapshot plus tail equals a full replay;
     - the blob key is scoped by org and version, and is reused.
4. **`feat: push store changes in realtime`**
   - `GET /sync/live` is a WebSocket. Authenticate with the Bearer token and the `X-Shopper-Device` header, and
     take the scope from the authenticated device only. Never put a token in the URL.
   - Cloud: the edge forwards the upgrade to the `StoreHub` DO (it already uses hibernation, in
     `packages/adapters/cf/src/coordination.ts`).
   - Box: use `hono/bun` `upgradeWebSocket` with `websocket` exported to `Bun.serve`, and one shared
     `boxRealtime()` instance (today `apps/box/src/app.ts` creates a separate one inside `boxPriceChange`). The
     Node test harness uses the installed `ws`.
   - Commands publish a `store.changed {sequence}` nudge after commit. The till pulls on every nudge, on every
     reconnect and on every push ack. When the socket is down it pulls on a capped backoff, starting at 30 s.
   - Add a documented exception to `platforms.md:82` ("never poll") for this transport fallback.
   - Load the `cloud-box-parity`, `durable-objects`, `workers-best-practices` and `wrangler` skills first.
   - Tests:
     - `realtime.test.ts`: a price change reaches a connected till in under 1 s; a killed socket falls back to
       polling, then reconnects.
     - Conformance on both adapters.
     - A workerd test that rejects a forged or missing device.
5. **`feat: issue receipt number blocks`**
   - Branch and device codes, `receipt_block`, overflow, and sale event **v2** (`receiptNumber`,
     `receiptOverflow`, `clockOffsetMs`) with a v1→v2 upcaster.
   - Hash the content after upcasting. `routes.ts:84` must accept known versions. Move golden fixtures to v2 and
     keep one v1 fixture.
   - Add `sale.occurred_at` and unique `(org_id, receipt_number)`.
   - Put receipt assignment in `packages/core/src/till/receipts/assign.ts`, because `record.ts` is already 225 lines.
   - Tests: `receipts/blocks.test.ts` (concurrent handshakes never yield more than 2 unused blocks and never overlap) and
     `occurred-at.test.ts`.
6. **`feat: add till sync status bar`**
   - `GET /sync/status` returns the head and server time.
   - Host `hostStatus` (`packages/sync/src/bridge/contracts.ts`) gains `mode` (live / polling / offline),
     `cursor`, `head`, `lastPullAt`, `receiptsLeft` and `overflow`, and combines the push and pull status in
     `packages/adapters/box/src/till/host/runtime.ts`.
   - The `apps/till-ui` status bar uses `useSyncExternalStore` and no effects, reuses `StatusBadge`, and has a
     **Sync now** action on key `Y` with the key shown. Cover every state: live, polling, offline, syncing,
     upgrade, revoked, receipts low and overflow.
   - Figma file `4MtEIWv8yBUBYgkrk4ubPk`: components are node 12:66; for the pattern, use node 45:852 (its nav
     strip and alert banner).
   - E2E test `tests/e2e/till-ui/status.spec.ts`: axe checks, plus screenshots at 1366×768, 1440×900 and 390×844.
7. **`test: pass the offline sync gate`** and **`docs: record day nine verification`**
   - `tests/integration/sync/offline-hour.test.ts`, with an injected clock: the till is offline for 1 h, records
     sales (including running into overflow) while the server gets product and price changes. After it
     reconnects, the server and till must agree exactly on the reference set, sales, sequences, receipt numbers
     and cursors, with no duplicates.
   - Update `packages/sync/README.md`, `platforms.md` and `architecture.md`, and write
     `docs/plans/2026-10-14-day9-verification.md`.
   - **Gate rule:** if this test is not green, stop, report it, and do not move on.

## Known leftovers from reviews

- Updating an already-archived product emits an upsert with `archivedAt` set. The till already hides such
  products, because `record.ts` filters on `archivedAt === null`. Keep that behaviour.
- `pullChanges` throws a plain Error for a store/org mismatch, which surfaces as 503. Optional: return 404.
- The `till_state.pull_cursor` DDL has no ALTER for existing till files. That is acceptable because till data is
  disposable.

## Process and rules for each slice

- Write failing tests first and see them fail for the right reason, then make the smallest change.
- Keep files ≤250 lines for `.ts` and ≤300 for `.tsx`. `index.ts` files only re-export. Use Valibot, never Zod.
  No `useEffect`.
- Run `vp check` and `vp run guard`, the targeted tests, and the workerd tests through
  `vp test --run tests/integration/edge/worker.test.ts`.
- Review with `codex review --uncommitted -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`, then fix
  every confirmed finding.
- Commit as the human git user. **No AI author, co-author trailer, generated-by footer or session link.**
- **Do not push until slices 3–7 are all committed and the full suite is green.**

## Finish

1. Run the full `vp test --run`, `vp check`, `vp run guard` and `vp run build`.
2. Push `codex/day9-sync-pull` and open a PR, using the PR body format in `docs/engineering/developer-experience.md`.
3. When CI is green, merge, then fast-forward local `main`.
4. Update Notion Day 9 (https://app.notion.com/p/3eba2c999ce981f2acb3e2a6a75bf11d):
   - Set Status to Done, and tick only the tasks and tests you verified.
   - Add "Completion remarks" in the Day 8 style. Include:
     - the commits with links;
     - test counts and gate evidence;
     - CI and screenshot links;
     - the resets you did;
     - the Rivet decision;
     - deferred work: `store_change` pruning, the Rivet StoreHub on day 36, Electron IPC;
     - review notes.
   - Read the page back afterwards.
