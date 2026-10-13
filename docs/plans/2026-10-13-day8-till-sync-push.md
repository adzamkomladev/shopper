# Day 8 — Durable till host, sync push, and connection screen

Approved 13 October 2026. Source: https://app.notion.com/p/3eba2c999ce981018523cb6a95fef4f3.

## Goal and boundaries

Record immutable sale snapshots in a headless Node till, deliver them exactly once to both backends,
and recover from process termination and lost responses. Add a status-only register connection screen.
Day 9 keeps bootstrap/pull/realtime; day 10 checkout; day 11 tenders; later native-driver/Electron work
keeps SQLCipher and main/preload wiring. Development SQLite is unencrypted; device time is untrusted.
Existing DB/DO/KV/local data is disposable and may be reset as needed.

## Test-first acceptance

- SQLite sale, lines, outbox, ordering counter and hash-chained audit commit together or all roll back.
- Reopen and concurrent transactions retain records and do not fork the audit chain.
- Golden sale fixtures retain UUIDv7 identities, integer quantities/money, dated tax snapshots and totals.
- 5,000 sales drain in batches <=200, exactly 5,000 server records and unique persisted store sequences.
- Replay all batches twice and concurrently; no extra business rows, sequences or acceptance/assignment audits.
- Reused identity with changed canonical content conflicts.
- SIGKILL actual host around acceptance, sequencing, response and local acknowledgement; restart same file.
- Partial/malformed/unknown acknowledgements only delete explicitly accepted submitted rows, or none.
- Transient network/429/5xx failures back off; permanent errors retain blocked rows and expose recovery.
- Device uploads survive cashier expiry; forged proofs, revoked devices and cross-tenant references fail.
- Versions appear in handshake/events/sales; N/N-1 and event upcasting tested independently.
- Both real coordination adapters conform; real WS and process IPC use one Valibot contract.
- Connection UI covers keyboard, empty/loading/error/offline/revoked/incompatible states, axe and screenshots.

## Implementation contracts

- New SQLite schemas: references, local sales/lines, outbox, state and audit, with org_id and UUIDv7 IDs.
- Explicit persistent local ordering counter, no AUTOINCREMENT. WAL, FULL, foreign keys and exclusive
  serialized async transactions through installed node:sqlite/Drizzle proxy in the adapter layer.
- @shopper/audit/sqlite exports defineCommand, reusing canonical serialization/redaction/hash projection.
- @shopper/core owns sale input/event schemas and local sale commands; sync orchestrates transport.
- Every local business, acknowledgement, retry and reference mutation is audited in its transaction.
- Snapshot original device/store/branch/cashier/session/version/time and price/product/tax/quantity/totals.
  Shared money/tax arithmetic only; server validates original snapshots without repricing today.
- Server stage 1: audited immutable acceptance with conflict(device_id, local_id), persisted pending sequence.
- Server stage 2: Sequencer.assignSale(orgId, storeId, deviceId, localId) returns existing sequence or
  allocates/stores it and audit in one PG transaction. CF StoreSequencer and box are thin shared callers.
- PG command replay hook executes under existing tenant advisory lock; identical retries skip mutation/audit.
- Device-only upload authentication; historical cashier-session proofs stay private to host and outside events.
  Session issued time/permission grant is retained; local creation requires valid sale.create authority.
- /sync handshake/push routes are shared Hono, included in runtime route dispatch, and mounted on both shells.
- One push loop, startup/commit/reconnect/retry triggers, <=200 plus byte bound, network outside local tx.
  Explicit accepted-ID/sequence acknowledgement validation; preserve local sales and rejected outbox rows.
- Build version constants; initial protocol/event 1, no imaginary protocol 0. Independent version dispatch
  and compatibility fixtures establish N/N-1/upcasting policy for subsequent published formats.
- Browser-safe sync bridge exports; correlated WS and process IPC messages share dispatcher.
- Approved dependencies: @hono/node-server 2.1.4, ws 8.22.0, @types/ws 8.18.2, existing Hono pin.
- Browser same-origin Vite proxy to loopback host, configured Origin allowlist and per-start capability in
  memory. Host owns credentials. Product screen shows identity, host/backend state, queues and errors.
- UI reuses @shopper/ui, useSyncExternalStore, shortcuts, no effects/polling. Figma file
  4MtEIWv8yBUBYgkrk4ubPk: components 12:66, register settings 146:4805, till workspace page 45:852.

## Slices and review gates

1. Audited local storage/contracts/migrations: feat: add audited till storage.
2. Local snapshots/outbox/golden fixtures: feat: record local sale snapshots.
3. Authentication/ingest/assignment/conformance: feat: ingest till sales idempotently.
4. Worker/acknowledgements/retries/versions: feat: add reliable till sync push.
5. Runnable host/WS/process IPC/restart: feat: connect till host transports.
6. Connection UI/e2e/screenshots: feat: add till connection screen.
7. Final acceptance/docs/evidence: docs: record day eight verification.

Use test-author, implementer/ui-builder, checker, reviewer and UI reviewer with explicit ownership.
Apply tdd-slice, cloud-box-parity, ui-screen/Figma and pre-merge-review before every progress commit.
Checks: vp check; vp run guard; vp test --run; real Workers runner; e2e/public e2e; build; typecheck.
Review on gpt-6.1-sol, fix confirmed findings, preserve human commit authorship.
Keep all progress commits local until every implementation/check/review is finished, then push branch.
Verify CI, then set existing Notion Day8 Done, tick verified tasks and append commit/test/screenshot/
reset/deferred-work remarks. Read back update. Do not mark unverified work complete.

## Evidence

Planning baseline: vp check and guard clean; 46 integration files / 181 tests passed; git clean.
Implementation evidence will be appended only after observed checks.
