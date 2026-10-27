# Day 24 · Sync chaos day

## Context

Notion row "24 · Sync chaos day" (phase 4 · Harden & pilot, Sync + Till, Wed 28 Oct). Goal: **break the
sync engine on purpose, before a supermarket does.** There are eight automated chaos scenarios, run against
the headless till host in CI. Fix everything they find. **Done when** every scenario is a green integration
test that runs on every push.

**What already exists, and the gaps:**

- `tests/support/till/host/{fixture,process,upstream}.ts` spawns the real till host
  (`apps/till/host/dist/server.js`) over IPC. It supports SIGKILL, push/pull gates and an offline switch.
- `sync/offline/hour.test.ts` runs 2,001 sales for one hour, in process, with block exhaustion.
- `sync/replay.test.ts` replays one event at the API. `till/host/restart.test.ts` kills the host before
  the reply for one sale.
- `occurred/at.test.ts` tests skew at the API only. `payments/host.test.ts` loses the creation reply.
- **Gaps:** none of these runs end to end through the host at chaos scale, and three real defects are
  open.
  1. **Cashier sessions last 8 h** (`packages/auth/src/devices/login.ts:71`). Offline, an expired
     session falls back to `OFFLINE_PERMISSIONS` (no `sale.create`), so **a till cannot sell after about
     8 h offline**. The 24 h scenario fails.
  2. The clock offset is measured only from `serverTime` replies. A wall-clock jump after the last
     handshake leaves a stale offset, which affects the session window, tax date and `occurredAt`.
  3. Two offline tills selling the last unit take on hand to −1 with no signal. The `StockHold` DO
     does not exist, and offline sales cannot use one anyway.

**Your decisions (27 Oct):**

- **Offline sign-in sells.** It creates a device-attested offline session that the server accepts.
- **Last unit:** accept both sales, take on hand to −1, and raise one _negative stock_ alert (Stock screen
  plus owner SMS).
- **Clock:** use a monotonic anchor while the host runs, and show a _Register clock is off_ banner above 5 min.

**How I work:**

- Everything runs in this session on Opus at medium effort, with **no subagents**. That overrides
  CLAUDE.md's `planner`/`reviewer` agent steps; I run their skills inline.
- In each slice, the tests come first and must be meaningful. I break the fix once on purpose to watch the
  test fail, then write the code, then run and fix.
- Skills: `tdd-slice`, `cloud-box-parity` plus `durable-objects`/`workers-best-practices` for the
  sequencer slice, `ui-screen`, `ui-verify` (playwright-cli) and `pre-merge-review`.
- MCPs: Figma, context7 (Vitest/miniflare DO abort) and Cloudflare docs.
- Codex reviews each slice and the whole branch:
  `codex review --uncommitted -c model="gpt-6.1-sol" -c model_reasoning_effort="medium"`.
- Git: branch `day24-sync-chaos` from `main@25db044`, one commit per slice, one push at the end.
- Data: dev, e2e and CI data is disposable. Migration 0032 has no backfill, I reset DBs freely, and
  protocol and event bumps get no upcasters, matching the Day 14 practice.

## Figma

- `173:3087` → `368:1709` "Shell · Offline": the yellow banner strip under the header (wifi-off icon, one
  sentence). The **clock banner** reuses it, and so does the **"Signed in offline"** user note from
  `367:1849` "Login · Offline".
- `12:66`: badge and input components. The **Negative** stock badge is the destructive badge.
- `227:4900`: responsive tabs, for the Stock list's new **Negative** filter tab.
- `27:2031` / `45:852`: till dashboard/checkout and transactions frames. They give context only; no new
  screens.
- There is no frame for the clock banner text or the negative-stock badge. They follow the patterns above,
  and the remarks will say so.

## Test harness (support only, lands with S1)

- Split `tests/support/till/host/upstream.ts` (247 lines, at the limit) into `upstream/{server,faults}.ts`.
  New faults:
  - `cut(prefix)`: destroy every connection for a path prefix, such as `/payments`, `/sync`, or everything.
  - `dropNextResponse(path)`: the server applies the request, then the socket dies before the reply.
  - `duplicateNextPush()`: forward the same body twice (concurrently, then once more) and return the last reply.
  - `holdNextPull()` already exists, and so does the push gate.
- `tests/support/till/host/clock.mjs` is a `--import` preload. It offsets `Date`/`Date.now` by an amount
  read from a file and re-reads the file on `SIGUSR2`. `performance.now` stays monotonic.
  `startTillHost(config, { clockFile })` adds `execArgv` and env. `fixture.setClock(ms)` writes the file
  and signals the host.
- Second till: `createHostFixture({ device: "second" })` enrols another device through
  `enrollFixtureTill` on the same branch, with its own SQLite file and receipt codes.
- Helper `expectConverged(fixture…)`: the outbox is empty; every local sale exists exactly once on the
  server with an equal payload and hash; store sequences and receipt numbers are unique; the tenant audit
  chain passes `verifyChain`.

## Slices (tests first; one commit each)

### S1 · Replay twice, kill mid-sync, DO restart mid-sequence

**Tests (`tests/integration/sync/chaos/`):**

- `replay.test.ts`: 200 sales sit queued. They include a loyalty customer sale, a MoMo-tendered sale and
  a credit-tendered sale. `duplicateNextPush()` sends the batch concurrently and then sequentially.
  - Every effect happens once: sale, sale_line, stock_movement, loyalty ledger, `receipt_email` row,
    fiscal doc, `sale.accept`/`assign-sequence` audits and the realtime envelope.
  - The replies carry identical sequences.
- `kill.test.ts`:
  - SIGKILL the host while a 200-event push is held after the server applied it, then restart → it converges.
  - SIGKILL during a held pull page, then restart → the cursor and references agree. The page is all or
    nothing.
  - A seeded loop of 10 random-delay kills during "complete sale → push". Invariants after every restart:
    each local sale is either still queued or acknowledged (never lost or doubled), and local receipt
    numbers stay contiguous.
- `tooling/worker/tests/sequencer.test.ts` (workerd, added to the include list):
  - Three devices assign concurrently while `runInDurableObject(stub, (_, ctx) => ctx.abort())` fires
    mid-stream. Sequences are unique and gap-free per store.
  - Assigning the same `localId` again after a restart returns the same sequence. `next(floor)` honours the
    floor after a restart.
  - Box parity: the same cases go into `packages/conformance` against `boxSequencer` with a fresh instance.
    The port does not change.
- `sequencer.test.ts` (host): `createFailAtSequencer(n)` fails the 3rd of 10 assignments mid-batch. The
  partial acceptance is acknowledged, and the retry finishes the rest once.

**Fixes:** whatever fails. A likely one is that the batch acknowledgment must survive a mid-batch
sequencer failure.

### S2 · Network cut mid-tender (`chaos/tender.test.ts`)

- **MoMo:**
  - Start a charge. The server and the Paystack fake create it, then `dropNextResponse("/payments/momo")`.
    The till shows pending.
  - While `/payments` is cut, the webhook confirms server-side.
  - On reconnect, `recover()` → the tender is confirmed → complete → push.
  - Assert: **one** Paystack charge, one `payment` row, one tender on the sale, and the payment linked to
    the sale.
  - Retrying the start with the same reference while cut is refused locally, and no second charge is sent.
- **Cash and card split while fully cut:** the sale completes offline, sits queued, and uploads exactly
  once after reconnect.
- **Cut during the push of a just-completed sale** (after the server accepted it): the retry is a
  duplicate-safe acceptance with one sequence.

**Fixes:** whatever fails, for example the draft stuck `busy` after an aborted payment request.

### S3 · Receipt-number block exhausted while offline (`chaos/receipts.test.ts`)

- Pre-consume the till's counter in SQLite to 2 numbers before the block end, then cut the network.
  - Sell 5: 2 normal and 3 overflow (`-X000001…3`).
  - SIGKILL, restart offline, sell 2 more: `-X000004…5`. The overflow counter survives the restart.
- A second till overflows at the same time. Its X numbers carry its own device code.
- Reconnect both:
  - every receipt number is unique on the server;
  - overflow sales are flagged and each has a fiscal doc;
  - the handshake refills, and the next sale is normal and sequential.

**Fixes:** whatever fails, for example an overflow counter that is not persisted in the sale transaction.

### S4 · Clock skew ±3 h, plus the clock banner (`chaos/clock.test.ts`)

**Tests:**

- The host starts **+3 h** ahead.
  - The handshake measures the offset, and `status.clockSkewMs ≈ +3 h`.
  - A sale gets a corrected `occurredAt` within ±5 s of server time and the right tax date, and its
    session is valid.
  - The server keeps the raw `deviceTime`, and nothing is clamped.
- The network is cut and the clock then **jumps −3 h** (SIGUSR2).
  - The sales keep correct corrected times; without the fix they come out 6 h early and the session
    refuses them.
  - Restart offline with no anchor: the till falls back to the stored offset, which the jump has
    rewritten, so the times stay correct.
- On reconnect everything converges.

**Code:**

- `packages/adapters/box/src/till/host/clock.ts` (new):
  - It keeps `{serverMs, monoMs}` from every reply that carries `serverTime` (handshake, push, and the
    pull head).
  - Before each bridge dispatch, it compares `Date.now()` with `serverMs + (performance.now() − monoMs)`.
    If they drift by more than 60 s, it rewrites `till_state.clock_offset_ms` through the existing audited
    receipts state command.
  - Every existing `hostTime` caller then works unchanged.
- Bridge status gains `clockSkewMs` in `@shopper/sync/bridge` (the browser-safe schema).
- Till UI: when |skew| > 5 min, the shell shows the offline-banner strip: "Register clock is 3 h ahead.
  Sales use the server's time. Fix the date and time on this computer." The note is persistent and has no
  action. The text follows from the status, with no effect.

### S5 · Offline sessions that sell, plus 24 h offline with 2,000 sales

**Design:**

- Offline sign-in with an expired server session still checks the cached verifier, as it does now.
  It then creates an **offline session**:
  `{id: v7, parentSessionId, userId, issuedAt, expiresAt = at + 8 h, permissions}`.
  - `permissions` = the parent session's permissions minus manager-only codes (`refund.approve`,
    `sale.discount`, `price.override`, `register.settings`).
  - It is stored and audited in the till's SQLite.
- The till keeps the **parent's proof** and sends it. The sale event goes to **v8** with optional
  `offlineSession {id, parentSessionId, issuedAt, expiresAt}`. `shift.closed` goes to **v3** with the same
  field, and the sync protocol goes to **5**.
- Server `sessionAuthority(…, offline?)` (`packages/core/src/sales/authority.ts`). For an offline session:
  - The parent row must match on token hash, device, branch and user, and must not be revoked.
  - `parent.issuedAt ≤ offline.issuedAt ≤ parent.expiresAt + 7 d` (the verifier window).
  - `expiresAt − issuedAt ≤ 8 h`, and the corrected time lies inside the offline window.
  - Permissions must be a subset of the parent's **and** pass `hasGrant` now (role_permission).
  - Then it upserts an audited `offline_session` row, once per id.
  - It is wired into the sale and shift lanes. Refund, credit and customer lanes refuse offline sessions
    with `INVALID_SESSION`, which is documented.
- Migration `0032_chaos.sql`:
  - `offline_session (id, org_id, parent_session_id, device_id, branch_id, user_id, issued_at, expires_at,
    permissions jsonb, created_at)`;
  - nullable `sale.offline_session_id` and `shift.offline_session_id`, plus the Drizzle schema in
    `packages/db/pg/src/schemas/sessions/offline.ts`.
- Accepted risk, written into the README: the offline window trusts the device's corrected clock. A forged
  device could already forge sales; revoking the device stops both.

**Tests:**

- `chaos/offline.test.ts` (in the `heavy` group, 600 s):
  - Cashier A signs in online, then the till goes fully cut for **24 h** of shim clock, with **2,000 sales**
    in total.
  - Every 50 sales the clock advances, the shift crosses midnight, and a dated VAT rule pulled beforehand
    takes effect at 00:00.
  - At 8 h, A's session expires, the next sale is refused, and A signs in offline and continues.
  - Cashier B takes over with a Z close, an offline sign-in and a new shift. A price change is made on the
    server mid-day.
  - On reconnect it converges:
    - 2,000 server sales, all accepted, each `offline_session_id` as expected, and 2 `offline_session` rows;
    - tax on each line matches the rule in force at its corrected time;
    - shifts and Z reports uploaded, store-day rollups for both days, and a valid audit chain.
- `sync/session/offline.test.ts`:
  - **refusals:** a forged parent proof, a window past 7 days, an offline session longer than 8 h,
    permissions beyond the parent's, a revoked parent or device, a role that lost `sale.create`, a refund
    with an offline session, and a replayed offline session on another device.

The existing `till/host/session/offline.test.ts` case "expired session only report and stock" changes to
"expired session sells under an offline session without manager permissions". This is an intended product
change, not a weakened test.

### S6 · Two tills sell the last unit (`chaos/stock.test.ts`) + Negative stock

**Tests:**

- Stock is 1, and both host fixtures are cut. Each sells 1.
- Both reconnect at once (`Promise.all` Sync now):
  - both sales are accepted, with no 5xx and no deadlock within the time budget;
  - on hand = −1000, from two movements;
  - **exactly one** `negative` alert and one owner SMS through the existing alert delivery;
  - `/stock` lists the product with `negative: true`, and the `negative` filter returns it.
- Receiving +5 clears the negative alert. Selling below zero again re-raises it once.
- A product without a reorder point still raises a negative alert.

**Code:**

- `stock_alert.kind` (`low|negative`, default `low`). The partial unique index becomes
  `(org, branch, product, kind) WHERE cleared_at IS NULL`, in 0032.
- `checkReorder` → `checkStockAlerts` in `packages/core/src/stock/reorder.ts`. It raises or clears
  negative for every sold product, and low only for products with a reorder point.
- The SMS template gets the negative wording. The stock list query and schema add `negative`.

**Portal (`@shopper/backoffice` `screens/stock`):**

- the destructive **Negative** badge in the on-hand cell;
- a **Negative** filter tab with a count (`227:4900`);
- the alert list shows the kind.
- Verified with `ui-verify` at 1920, 1440, 1366, 768 and 390, keyboard and axe. `skeleton-audit` runs if
  the tab count changes the skeleton.

### S7 · CI, docs, review, ship

- `vite.config.ts`: the chaos `offline.test.ts` and `kill.test.ts` join `heavy`; the rest stay in
  `integration`. All of it runs in the existing integration shards on every push and PR. Add
  `"test:chaos": "vp test --run tests/integration/sync/chaos"` to the root scripts for local runs.
- Docs:
  - `packages/sync/README.md` (protocol 5, sale v8, offline sessions, clock anchor);
  - `apps/till/host/README.md` (offline selling, clock banner, the test clock preload);
  - `docs/engineering/testing.md` (the chaos harness and its faults);
  - `docs/plans/day24/{plan,verification}.md` with screenshots.
- `vp check`, `vp run guard`, `vp run typecheck`, `vp test --run`, `vp run build` and the e2e suite.
- `pre-merge-review`: Codex on the whole branch, with every finding verified and fixed or answered.
- Push → PR "Day 24: sync chaos" (no AI attribution) → `ccd_pr` `get_status`/`bind_pr` → watch CI and
  auto-fix until green → squash-merge → `git pull --ff-only` on main.
- Notion: Day 24 row Status = Done, ticks on every checkbox, and a **Remarks** section in the Day 23
  style (what landed, decisions, tests, review fixes, CI fixes, upgrade notes, known limits, process).

## Files touched (representative)

- **Tests:**
  - `tests/integration/sync/chaos/{replay,kill,sequencer,tender,receipts,clock,offline,stock}.test.ts`
  - `tests/integration/sync/session/offline.test.ts`
  - `tooling/worker/tests/sequencer.test.ts`
  - `tests/support/till/host/{upstream/server,upstream/faults,clock.mjs,fixture,process}.ts`
- **Till host:**
  - `packages/adapters/box/src/till/host/{clock,session,runtime,sync}.ts`
  - `packages/core/src/till/session.ts`
- **Sync:**
  - `packages/sync/src/{schemas/bridge/session.ts,push/*}`
  - `tooling/build/info.ts` (`SYNC_PROTOCOL: "5"`)
- **Core:**
  - `packages/core/src/schemas/till/{sale,shift}.ts`
  - `packages/core/src/sales/{authority,accept}.ts`
  - `packages/core/src/shifts/{authority,accept}.ts`
  - `packages/core/src/stock/reorder.ts`
- **DB:**
  - `packages/db/pg/migrations/0032_chaos.sql`
  - `packages/db/pg/src/schemas/{sessions/offline,stock}.ts`
  - the till SQLite `offline_session` table
- **UI:**
  - `apps/till/ui` shell banner
  - `packages/backoffice/src/{screens,components,queries}/stock/*`

## Verification

- Each chaos test is shown red once against the unfixed code, then green.
- The full suite runs locally with `vp run services:up`, `vp test --run`, plus `vp run test:chaos` three
  times in a row to catch flakes.
- The workerd suite runs through `tests/integration/edge/worker.test.ts`.
- Till banner and portal Negative tab: `ui-verify` with playwright-cli against the real app at all sizes,
  with every state, keyboard and console. Screenshots go in `docs/plans/day24/screenshots`.
- The PR's CI is green on the exact reviewed head before the merge.

## Known limits

- These will go into the remarks: there is no StockHold DO (offline sales cannot hold stock), and the
  offline window trusts the device clock.
- Two things can only be checked on the pilot hardware (Windows): monotonic time across sleep and hibernate,
  and a real cable pull.
