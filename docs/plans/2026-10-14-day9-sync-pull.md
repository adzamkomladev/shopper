# Day 9 — Sync pull, realtime, bootstrap (SYNC GATE)

Approved 14 October 2026.

Source: Notion Day 09 (https://app.notion.com/p/3eba2c999ce981f2acb3e2a6a75bf11d). Branch `codex/day9-sync-pull`.
Figma `4MtEIWv8yBUBYgkrk4ubPk`: components 12:66, till workspace 27:2031, Barcode Scanner / Previous
purchases 45:852. No dedicated sync frame exists: the status bar reuses 45:852's nav strip and alert banner
plus the day-8 `StatusBadge`.

## Context

Day 8 made push boring. Reference data (products, prices, tax rules) still reaches a till only by manual
provisioning (`provisionTillReference`), and realtime envelopes live only in StoreHub's 500-message replay
log. PostgreSQL has **no change feed**: `publishPrice` builds sequenced envelopes but persists nothing,
`setPrice` publishes nothing, and neither shell passes Realtime or Blobs to the API. Day 9 makes reference
data flow down reliably and fast, adds receipt-number blocks and a server-assigned sale time, and must pass
the gate: **a till offline for an hour with sales reconnects and agrees exactly with the server.**
All DB/DO/KV/blob/till SQLite data is disposable: reset freely, no backfills.

## Reuse (do not rebuild)

- `allocateStoreSequence` (`packages/core/src/sequence.ts`): the cursor space is `store.last_seq`.
- `Realtime` port (`packages/ports/src/types.ts:67`), `StoreHub` DO with hibernation
  (`packages/adapters/cf/src/coordination.ts:60`), `boxRealtime` (`packages/adapters/box/src/realtime.ts`), and the
  conformance realtime case.
- `Blobs` port, `cloudflareBlobs` (R2 `BLOBS` binding already in wrangler) and `boxBlobs` (`adapters/*/src/storage.ts`).
- Device auth `resolveUploadPrincipal` (`packages/auth/src/devices/upload.ts`). Sync routes, protocol
  negotiation, and `createPushTransport` (`packages/sync/src/push/http.ts`).
- Push worker patterns: injected `now`/`random`, backoff, `trigger`/`subscribe`. Till `reference`/`till_state`
  tables. `upcastEvent` (`packages/core/src/schemas/events.ts`).
- Test harness: `postgresFixture`, `createPushFixture` (injected clock and `advanceTime`), host fixture,
  connection e2e scenario/proxy, and the workerd runner `tooling/worker-tests`.
- Hono WebSocket helpers: `hono/bun` for the box shell, and the installed `ws` for the Node test harness. No new dependencies.

## Design

1. **Generic change feed (v1.5 hook).**
   - **Table.** New PG `store_change(org_id, store_id, seq, id uuidv7, entity, entity_id, op upsert|delete, v,
payload jsonb, created_at)`, PK `(org_id, store_id, seq)`.
   - **Writer.** `recordChanges(tx, orgId, changes, storeIds)` in `core/src/changes/record.ts`:
     - It is called **last** in each command.
     - It locks stores in sorted id order and allocates one range per store (`last_seq += n`).
     - Payloads are built by one shared per-entity projection, `core/src/changes/project.ts`. The feed and the
       snapshot both use it.
   - **Wired into** product save/archive, `setPrice`, `publishPrice`, tax-rule save and import apply (one call).
     Archive, ended price and cancelled price emit `op: delete`, and the till deletes the row.
   - **Prices** ship `validFrom`/`validTo`/`branchId`. The till resolves them by corrected time and branch, so
     an offline till never misses a boundary. The workflow `end` phase emits only the delete.
   - **Publishing.** `publishPrice` moves to `prices/publish.ts`. The realtime publish becomes its own step
     after the commit step.
2. **Pull.** `GET /sync/changes?cursor=&limit≤500`, device-scoped:
   - Rows are read with `seq > cursor ORDER BY seq` in a REPEATABLE READ transaction together with the head.
   - Gaps are normal, because sales share the store sequence.
   - The cursor is the last returned seq, or the head when no rows remain.
   - The response is `{ snapshot: true }` when the cursor is 0 or more than 50,000 **change rows** are pending
     (counted with `LIMIT 50001`).
   - The till halts with "upgrade needed" on an unknown payload `v`. It never skips a row.
3. **Snapshot bootstrap (R2/box blobs).** `GET /sync/snapshot`:
   - `buildSnapshot` reads the reference set and the max change seq in one REPEATABLE READ transaction, using
     the shared projection.
   - It streams gzipped JSON into Blobs at `snapshots/<org>/<store>/v<v>/<maxChangeSeq>.json.gz`, reuses the blob
     if one exists, and streams it to the till.
   - The till replaces its reference set and sets its cursor in one audited SQLite command, then pulls the tail.
4. **Realtime and fallback.**
   - **Route.** `GET /sync/live` WebSocket. The shared route authenticates the Bearer and `X-Shopper-Device`
     headers and derives `org:store:device` from the principal only. The client query never names the device,
     and tokens never go in URLs.
   - **Cloud.** The edge forwards the upgrade to `StoreHub` (hibernation), with the DO URL built from the principal.
   - **Box.** `hono/bun` `upgradeWebSocket`, with `websocket` exported to `Bun.serve`. One shared `boxRealtime()`
     instance is used by both the routes and `boxPriceChange`. This fixes today's separate instance.
   - **Nudges.** Commands publish a `store.changed {sequence}` nudge only after commit. The till pulls on every
     nudge, on every (re)connect and on every push ack.
   - **Socket down.** The till falls back to pulling on a backoff timer (30 s, capped) and reconnects. A lost
     nudge is harmless.
   - **Revoked devices.** A revoked device's open socket only ever sees nudges. Its next pull returns 401.
   - **Rule exception.** Add a documented exception to `platforms.md:82` for this transport fallback.
5. **Receipt-number blocks.**
   - **Codes.** `org.branch_counter` → `branch.code` (`BR01`). `branch.device_counter` → `device.code` (`T03`).
     Both come from atomic counters, with unique `(org_id, code)` and `(branch_id, code)`.
   - **Allocation.** `device.receipt_last` is advanced atomically (`+1000 RETURNING`). Blocks are stored in
     `receipt_block` and audited. They are issued **only on POST** (handshake and push ack), while fewer than 2
     unused blocks remain.
   - **Delivery.** Every response re-sends all outstanding blocks above the till's reported last-used number,
     so a lost response is harmless.
   - **Till side.** The till assigns `BR01-T03-000001` inside the sale transaction (`core/src/till/receipts.ts`).
     When blocks are exhausted offline it uses a separate overflow counter, `BR01-T03-X000001`, with
     `receiptOverflow: true`. PG has unique `(org_id, receipt_number)`.
6. **Sale time (decided: corrected till time).**
   - The till measures `clockOffset` from server time at each handshake and stamps it on the sale.
   - The server sets `occurred_at = deviceTime − offset`, clamped to no later than acceptance.
   - Tax and session checks use that same time. Raw `device_time` is kept. The ack returns `occurredAt`.
7. **Sale event v2.** It adds `receiptNumber`, `receiptOverflow` and `clockOffsetMs`.
   - Upcaster v1→v2: receipt null, offset 0.
   - The content hash is computed **after** upcasting.
   - `routes.ts` accepts the known versions.
   - Golden fixtures move to v2, keeping one v1 fixture.
8. **Sync status.**
   - `GET /sync/status` returns head and server time.
   - The host's `hostStatus` gains `mode` (`live` | `polling` | `offline`), `cursor`, `head`, `lastPullAt`,
     `receiptsLeft` and `overflow`.
   - The status bar in `apps/till-ui` shows "Live · synced 3 s ago · 4 pending" with a "Sync now" button
     (key `Y`, shown on the button).
   - States: live, polling, offline, syncing, upgrade needed, revoked, receipts low, and overflow in use.

## Behaviours as tests (written first)

All files below are under `tests/integration/sync/` unless noted.

- `changes.test.ts`
  - Each till-visible mutation writes feed rows and an audit row in the same transaction; a rollback writes none.
  - Archive and price end emit deletes.
  - A branch price touches only its store.
  - Two concurrent multi-store changes do not deadlock, and an import makes a single call.
- `pull.test.ts`
  - Paging, and gaps from interleaved sales skip nothing.
  - A commit that races the head is not skipped.
  - An unknown `v` halts the till.
  - Wrong tenant or store is rejected, a revoked device gets 401 and a wrong protocol gets 409.
- `snapshot.test.ts`
  - **A new till bootstraps from a snapshot.**
  - More than 50,000 pending change rows (seeded with `generate_series`) triggers a snapshot.
  - Snapshot plus tail equals a full replay.
  - The blob key is scoped by org and `v`, and the blob is reused for the same max change seq.
- `realtime.test.ts`
  - **A price change reaches a connected till in under 1 s** (real host, server and WebSocket).
  - A killed socket leads to polling catching up, then a reconnect.
  - Conformance runs on both adapters.
  - The workerd test proves the edge reaches StoreHub, rejects a missing or forged device, and hibernates.
- `receipts.test.ts`
  - Numbers are sequential and refill on sync.
  - Concurrent handshakes leave at most 2 unused blocks with no overlap.
  - A lost response is re-delivered.
  - Overflow `X` numbers are flagged.
  - Codes stay unique under a race.
  - A v1 event upcasts.
- `occurred-at.test.ts`
  - An offline-hour sale keeps its corrected time, not the reconnect time.
  - A skewed clock is corrected.
  - The tax date is unchanged and device time is kept.
- `offline-hour.test.ts` (**GATE**), using the injected clock:
  - The till is offline for 1 h, recording sales (including block exhaustion into overflow), while the server
    receives product, price and tax changes.
  - On reconnect the server and till agree exactly: reference set, sales, store sequences, receipt numbers and
    cursors, with no duplicates.
- `tests/e2e/till-ui/status.spec.ts`
  - Every status-bar state and the `Y` Sync now key.
  - axe checks and screenshots at 1366×768, 1440×900 and 390×844.

## Size-limit splits (do first, in slice 1/2)

- `sync/src/push/worker.ts` (246 lines): move the handshake to `sync/src/connection.ts`, shared by push and pull.
- New pull code: `sync/src/pull/{worker,apply,snapshot}.ts`, `sync/src/status.ts` and `sync/src/receipts.ts`.
- `core/.../prices/workflow.ts` (223 lines): move `publishPrice` to `prices/publish.ts`.
- `core/src/till/record.ts` (225 lines): receipt assignment goes in `till/receipts.ts`.
- New routes: `api/src/sync/{pull,snapshot,live,status}.ts`.
- `tests/support/till/server.ts` (210 lines): new feed and realtime helpers go in `tests/support/till/feed.ts`.

## Slices (each one becomes a local progress commit)

1. `feat: add store change feed`
   - Migration 0011 (feed table, codes and counters, receipt columns, `occurred_at`).
   - Refactor splits, `recordChanges` and wiring.
   - `changes.test.ts`.
   - Save this plan to `docs/plans/2026-10-14-day9-sync-pull.md`.
2. `feat: serve till sync pull`
   - Pull route on both shells, conformance, the shared connection module, and the till pull worker with
     apply and deletes.
   - `pull.test.ts`.
3. `feat: bootstrap tills from snapshots`: Blobs wired into both shells, and `snapshot.test.ts`.
4. `feat: push store changes in realtime`
   - Live route, edge→StoreHub, box Bun WebSocket, the shared hub, and fallback polling.
   - The `platforms.md` exception.
   - `realtime.test.ts` and the workerd test.
5. `feat: issue receipt number blocks`
   - Codes, blocks, overflow, event v2 and upcaster, and corrected `occurred_at`.
   - `receipts.test.ts` and `occurred-at.test.ts`.
6. `feat: add till sync status bar`: status endpoint, host status, the UI and the e2e test.
7. `test: pass the offline sync gate`, then `docs: record day nine verification`
   - Update the sync README, `platforms.md` and `architecture.md`.
   - Write `docs/plans/2026-10-14-day9-verification.md`.

**Process for each slice:**

1. Run the `tdd-slice` skill. `test-author` writes the failing tests, and I confirm they fail for the right reason.
2. Build: `implementer` for backend slices, `ui-builder` with the `ui-screen` skill and Figma MCP for slice 6.
3. Load these skills before writing code:
   - `cloud-box-parity` for slices 2–5.
   - `durable-objects`, `workers-best-practices` and `wrangler` before touching StoreHub or the edge.
   - context7 for the Hono Bun/WebSocket APIs.
4. Run the `checker` agent: `vp check`, `vp run guard`, `vp test --run`, workerd tests, e2e and build.
5. Run the `pre-merge-review` skill: the `reviewer` agent (Codex `gpt-6.1-sol`), plus `ui-reviewer` with
   screenshots for slice 6.
6. Fix every confirmed finding.
7. Commit locally with human authorship and no assistant trailers.

## Rules at risk and how they are kept

- **Audit:** every feed write, block issue, snapshot apply, cursor move and code allocation goes through
  `defineCommand`.
- **Tenancy:** every new table has `org_id`. Scope always comes from the device principal.
- **Ports:** DO, R2 and Bun handles stay in adapters and shells. Logic lives in core, api and sync, and the
  shells stay under about 20 lines.
- **Money:** prices travel as integers. Nothing is repriced on the server.
- **Versioning:** event v2 plus an upcaster, protocol N/N−1, and the snapshot `v` in the key.
- **Coordination classes:** no sixth DO; StoreHub is reused. Polling is a documented transport fallback,
  not business logic.
- **Deferred:** `store_change` retention and pruning (needed once snapshots dominate); a Rivet StoreHub actor
  (day 36); Electron IPC wiring.

## Decisions (confirmed with user, 14 Oct)

- Branch and terminal codes are auto-assigned (`BR01…` per org, `T01…` per branch) and not editable yet.
- Each till holds two blocks of 1,000 receipt numbers, refilled on sync. When they run out offline, it switches
  to a flagged overflow series. This series uses an `X` marker instead of the `9xxxxx` range first proposed,
  because `9xxxxx` collides once the normal range reaches 900k.
- `occurred_at` is the corrected till time, clamped to acceptance; raw device time is kept.
- Finish: push the branch, open a PR, merge on green CI and fast-forward local main.
- **Box realtime uses the in-process hub now, and the Rivet actor comes on day 36.** I evaluated
  RivetKit 2.3.27 (actor connections and broadcast, raw `onWebSocket`, beta hibernation; the dev engine is
  already in compose) against a Bun WebSocket.
  - **Why not Rivet now:** it adds the `rivetkit` dependency, the engine in CI and the integration tests,
    unverified `bun --compile`, and beta raw-WebSocket hibernation, all on gate day.
  - **Day 9:** the shared `/sync/live` route with a Bun WebSocket and the shared `boxRealtime` hub.
  - **Day 36:** swap the hub for a Rivet StoreHub actor behind the same `Realtime` port and conformance suite,
    proxied through `/sync/live`. The till keeps one plain WebSocket client for cloud and box, and the
    Rivet engine port is never exposed on the LAN.
  - Record this trade-off in `platforms.md` and the day 9 plan doc.

## Verification and finish

- **Gate.** `offline-hour.test.ts` green locally and in CI. If it is red at the end of the day, apply the
  Notion gate rule: stop, fix sync next, and shift days 10–13.
- **Manual end-to-end check:**
  1. `vp run services:up`, `db:migrate`, `db:seed`.
  2. Run the edge (wrangler dev) and the box, then start till-host and till-ui.
  3. Change a price in the portal and see the till update in under 1 s.
  4. Kill the network and confirm the bar shows polling/offline. Ring sales offline, reconnect, and confirm
     the counts agree.
  5. Screenshot the bar.
- **Push and merge.** Push the branch only after every slice is reviewed and green. Then open the PR, confirm
  CI with the `ccd_pr` tools, merge, and fast-forward main.
- **Notion.** Set Day 9 to Done and tick the verified tasks and tests. Add completion remarks:
  - commits
  - test counts
  - gate evidence
  - screenshots and CI links
  - resets performed
  - deferred work
  - review notes

  Then read the page back. Never tick unverified work.
