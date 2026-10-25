# Day 20 · Audit system UI — plan

## Context

**Notion row:** 20 · Audit system UI (Audit, Portal), P0. **Goal:** full traceability the owner can see and trust. **Done when:** "Who changed this price, when, on which device, approved by whom?" is answered in three clicks.

**Card tasks:** audit viewer filtered by actor, role, device, branch, entity, command and date range · before/after diff, with the approver shown on overrides · chain verification per device stream and per org, with a clear pass/fail · daily anchor (the day's final chain hash on the Z-report, emailed to the owner) · audit CSV export (also for the Shopper Archive) · 6-year retention; PINs and secrets never logged.
**Required integration tests:** a row tampered directly in the DB → the verifier flags exactly that entry · every command run by the golden fixtures produced an audit row.

### What exists today

- `@shopper/audit`: `defineCommand` (PG) appends one hash-chained row per org (`audit_log`, `chain_seq`/`prev_hash`/`hash`, v1 canonical projection). `verifyChain(rows, expectedFinalHash?)` names the first bad entry. `redact()` strips PIN/secret keys. DB triggers reject UPDATE/DELETE/TRUNCATE.
- Till: `@shopper/audit/sqlite` `defineCommand` keeps a **separate per-device chain** in `till_audit`. It never leaves the till. The Z stores its head as `anchorSeq`/`anchorHash` (`core/src/till/shifts/close.ts`), and the server keeps them on `shift`.
- `audit.read` permission exists (superadmin, admin, accountant). There is no audit API or screen yet.
- `price.set` audits `entity: "price"`, `entityId: <new version id>`, `before: null`, so a product's price history can't be found from the product.
- Scheduler port declares "one daily watchdog", but nothing implements it on either runtime.
- `@shopper/export` is empty (the Shopper Archive is Days 41–44).
- Figma (`4MtEIWv8yBUBYgkrk4ubPk`): the pages are New Login, Web Flow, Componets, Login, Dashboard and Barcode Scanner. As on Days 18–19, **no audit frames exist**. The viewer follows the 45:852 "Previous purchases" table pattern (segment tabs, search, table, status badges), the Day 19 fiscal sheet, and the 12:66 inputs. Figma stays read-only; the missing frames go in the remarks.

### Your decisions (25 Oct)

- **Till chains upload to the server.** The viewer merges the org stream with every device stream, and verification runs per device and per org.
- **Daily anchor:** the one watchdog **cron** (23:59 UTC = Accra, no DST) launches a **one-shot workflow per org per day** (instance id = business key `anchor-{orgId}-{yyyy-mm-dd}`). No long-lived workflow.
- **Z cross-check included:** the server checks each Z against its own sales and refunds for that session.
- **Standing rules:** data is disposable (reset PG, DOs, D1 and till DBs freely). Figma is read-only. **No subagents**: everything runs in this session. `codex review -c model="gpt-6.1-sol"` runs inline before each commit. One commit per slice, one push at the end, then a PR and the Notion remarks. Run `vp check --fix` after every step. Never stage `.claude/settings.json`. No AI attribution.

### Skills / MCPs used

`/feature-plan` (this plan) · `/tdd-slice` per slice · `/cloud-box-parity` + `cloudflare`/`workers-best-practices` skills and `cf docs search` for the cron trigger and workflow · `/ui-screen` → `/ui-verify` with `playwright-cli` at desktop, laptop, tablet, mobile and till sizes · `/skeleton-audit` for the new fallbacks · `/pre-merge-review` (codex inline) · Figma MCP (read-only) · shadcn MCP for any missing primitive · Notion MCP for the remarks.

---

## Slices (each one: tests first → implement → `vp check --fix` · `vp run guard` · targeted tests → codex review → commit)

### Slice 0 — Branch and reset

`git switch -c day20-audit origin/main` · `vp install` · `vp run services:up` · `vp run db:reset && vp run db:migrate && vp run db:seed`.

### Slice 1 — Schema, paged verification and the org tamper test

- **Migration `0028_audit.sql`** (forward-only, idempotent) and Drizzle in `db/pg/src/schemas/audit.ts` (move `auditLog`'s audit fields reuse; keep `audit_log` where it is):
  - `device_audit`: the same audit columns as `audit_log` plus a required `device_id`. PK `(org_id, device_id, chain_seq)`, unique `id`. Reuse the existing append-only trigger function.
  - `audit_anchor`: `id` v7, `org_id`, `day date`, `stream` (`'org'` or the device id), `chain_seq`, `hash`, `created_at`. Unique `(org_id, day, stream)`, append-only.
  - Viewer indexes on both audit tables: `(org_id, id DESC)`, `(org_id, entity, entity_id)`, `(org_id, actor_id)`, `(org_id, device_id)`, `(org_id, command)`.
- `verifyChain` gains an optional start `{ seq, hash }`, so a stream verifies in pages without loading six years at once. Hashes are unchanged.
- `core/src/audit/verify.ts` `verifyStream(db, orgId, stream)`: pages of 2000 rows by `chain_seq`; checks every `audit_anchor` for the stream against the row at its seq; a head below the last anchor fails with `anchor`. Returns `{ valid, count, head, anchors }` or `{ valid: false, entryId, seq, reason }`.
- **Tests first** `tests/integration/audit/tamper.test.ts`, using `SET session_replication_role = replica` to bypass the triggers:
  - edit one row's `after` → flags exactly that id, reason `hash`;
  - delete a middle row → flags the next row (`sequence`);
  - truncate the tail behind an anchor → `anchor`;
  - an untouched chain → pass with the right count and head;
  - DELETE on `audit_log`, `device_audit` or `audit_anchor` raises (retention).

### Slice 2 — Till chains upload (`POST /sync/audit`)

- **Till** `packages/sync/src/uploads/audit.ts`: send `till_audit` rows after the server's head in batches of 500, on the existing upload triggers, **before** shifts so a Z's anchor seq is already on the server. The cursor is the server's answered head kept in host sync state. The cursor write is not audited (an audited mark would append to the chain it uploads, forever). Wire it into `adapters/box/src/till/host/sync.ts` start/trigger/stop.
- **Server** `core/src/audit/device.ts` `ingestDeviceAudit` (a `defineCommand`, `device.audit.upload`, audited with from/to seq and head hash, so the org chain anchors each device head):
  - rows must belong to the principal's org and device;
  - they must continue the stored head (`chain_seq` contiguous, `prev_hash` = head hash);
  - `hashEntry` must match.

  A re-sent batch that is already stored replays as accepted. A gap, fork or bad hash is `rejected` (terminal for that batch, logged and audited as `device.audit.rejected`); the till stops and shows it. Route `api/src/sync/audit.ts`, with a Valibot body in `api/src/schemas/sync/audit.ts`.

- **Tests first** `tests/integration/audit/device.test.ts`:
  - contiguous upload accepted, and the server rows equal the till rows;
  - re-upload is idempotent;
  - gap, forged hash and wrong device are each rejected;
  - a tampered `device_audit` row is flagged by `verifyStream(device)`.

  Extend `tests/integration/sales/golden/day.test.ts`: **every command the golden fixtures ran produced an audit row**:
  - every sale, refund, shift, fiscal doc and stock document the day created is named by an audit row (`entity`/`entityId`) on its chain;
  - after upload, `device_audit` equals `till_audit` and every stream verifies.

### Slice 3 — Viewer API, diff data, CSV

- `core/src/audit/queries.ts`:
  - `listAudit(db, orgId, filters, cursor)` over `audit_log ∪ device_audit` (a `stream` column of `org` or the device id), newest first by `id` (v7). Filters: actor, role, device, branch, entity + entityId, command, from/to. 50 a page with a cursor. Actor, approver, device and branch names are joined in.
  - `readAudit(id)` returns full before/after/payload, seq/hash, server and device time.
  - `auditFacets(orgId)` returns the users, roles, devices, branches, commands and entities seen.
- `core/src/audit/export.ts` `auditCsv(db, orgId, filters)`: same filters, streamed in pages with `toCsv` (`@shopper/utils`). Columns: time, device time, stream, seq, actor, role, device, branch, command, entity, entity id, approver, reason, before, after, hash. Exported for the Archive to reuse later.
- `api/src/routes/audit.ts` behind `audit.read`: `GET /audit`, `/audit/facets`, `/audit/export.csv` (registered before `/:id`), `/audit/streams` (org + each device: count, head, last anchor), `/audit/verify?stream=`, `/audit/:id`.
- `price.set` details become `entity: "product"`, `entityId: productId`, `before` = the version in force before the insert (`priceAt`), `after` = the new version, so a product's history includes its price changes.
- **Tests first** `tests/integration/audit/viewer.test.ts`:
  - each filter narrows correctly, and cursor pages neither repeat nor skip;
  - org and device rows are merged;
  - two price changes appear in the product's history with before/after amounts, reason, device and approver;
  - a till price override shows its approver;
  - a cashier gets 403;
  - the CSV matches the filtered rows and escapes commas and quotes;
  - **no audit row or CSV contains a raw PIN or password** used in the fixtures.

### Slice 4 — Daily anchor: watchdog cron → one-shot workflow → email

- `core/src/audit/anchor.ts`:
  - `runWatchdog(deps, at)` lists orgs and starts `anchor-{orgId}-{day}` (start is idempotent);
  - the workflow `runAuditAnchor(flow, deps, params)` has step `anchor`, a `defineCommand` `audit.anchor` that inserts one `audit_anchor` row per stream (org head before this command plus each device head) and enqueues `audit.anchor` after commit;
  - the notification consumer gains `audit.anchor`, which emails each owner (superadmin users with an email) through the existing `mail` dep. The email lists each stream's seq and hash and links to `/audit/integrity`. With no mail credentials it retries, matching the existing convention.
- **cf:** cron trigger `59 23 * * *` in the edge config and a `scheduled` handler that calls `runWatchdog`. `AuditAnchorWorkflow` lives in `adapters/cf/src/workflows/anchor.ts`, modelled on `fiscal.ts` (one-shot).
- **Box:** the Scheduler adapter is one Bun timer to the next 23:59 UTC that re-arms itself. The anchor flow lives in `adapters/box/src/workflows/anchor.ts`, modelled on the box `fiscal.ts`.
- **Conformance:** a Scheduler case in `packages/conformance` that fires once at the scheduled instant (fake clock), run against both adapters.
- `ponytail:` a day the cron misses has no anchor; the next day's anchor still covers everything before it.
- **Tests first** `tests/integration/audit/anchor.test.ts`:
  - the watchdog starts exactly one instance per org per day, and running it twice starts no second one;
  - the workflow writes the org and device anchors equal to the heads, and one email per owner;
  - a tail truncation after an anchor fails verification with `anchor`.

### Slice 5 — Z cross-check and anchor check on shifts

- `readShift`/`listShifts` compute at read time; nothing is stored, so a late upload corrects itself:
  - **cross-check:** the server's sales and refunds for the shift's session versus the Z, for sale count, gross, refunds and takings per tender. Result: `matched`, or `mismatch` with the differing fields;
  - **anchor:** the `device_audit` row at `anchorSeq` has `anchorHash` (`verified`), isn't uploaded yet (`pending`), or doesn't match (`mismatch`).
- **Tests first** `tests/integration/shifts/crosscheck.test.ts`:
  - a shift with sales, refunds and a drop is `matched`;
  - a Z with an inflated cash total is `mismatch` naming cash;
  - the Z anchor is `verified` after the audit upload and `mismatch` after tampering.

### Slice 6 — Portal: Audit log screen (`/ui-screen`)

- `routes/audit.tsx` (tabs Log | Integrity, like `routes/tax.tsx`); nav item "Audit" with `audit.read` in `lib/shell/nav/items.ts`.
- `screens/audit/log/screen.tsx`, `components/audit/log/{filters,table,sheet,diff,states}.tsx`, `queries/audit/{list,detail,facets}.ts`, `schemas/audit.ts`:
  - filters live in validated search params, so links and back/forward work;
  - a date range plus selects for actor, role, device, branch, entity and command;
  - the table shows time, actor, role, command, entity, device, branch and an approver badge, with Load more;
  - Export CSV uses `lib/download.ts`;
  - the row sheet shows who/when (server and device time), device, branch, **"Approved by"**, reason, a field-level before/after diff (changed rows highlighted; the diff is a small pure function in `lib/audit/diff.ts`), a collapsible raw payload, and seq/hash.
- **Three clicks:** a product detail **History** button → `/audit?entity=product&entityId=…` → a row → the sheet answers who, when, which device and who approved.
- Every state: skeleton, empty, filtered-empty, error, offline, no permission. Shortcuts: `/` filters, `E` export, `Esc` closes the sheet; keyboard row navigation.

### Slice 7 — Portal: Integrity screen and shift badges

- `screens/audit/integrity/screen.tsx`:
  - a streams table (Org chain + each register): entries, head seq/hash, last anchor, and a **Verify** button (plus Verify all, `V`);
  - a Pass/Fail badge; Fail names the reason and links to the flagged entry's sheet;
  - a recent anchors list.
- Shift detail shows **Anchor verified/pending/mismatch** and **Totals matched/mismatch** (with differing fields); the shifts list gains a Mismatch badge.
- **e2e** `tests/e2e/portal/audit.spec.ts`:
  - the three-click price path;
  - filters and URL round-trip;
  - CSV download;
  - verify pass, then a tampered DB row → Fail linking to the entry;
  - shift mismatch badge.
- `/ui-verify` at desktop, laptop, tablet, mobile and till sizes in every state, plus the keyboard path, console and overflow; `/skeleton-audit`. Screenshots go in `docs/plans/day20/screenshots`.

### Slice 8 — Docs, full run, push, PR, Notion

- Update the `@shopper/audit` README (device streams, anchors, paged verify, retention: append-only, never purged within six years), `docs/engineering/platforms.md` (the watchdog now launches anchors; cron schedule), `architecture.md` (the device chain upload contract). `docs/plans/day20/{plan,verification}.md`.
- Full `vp check`, `vp run guard`, `vp test --run`, e2e and build; fix whatever comes up. A final whole-branch codex review. **One push**, PR, then CI. Update the Notion row: Status Done, tasks/tests ticked, remarks in the Day 17 format (shipped, tests, review, decisions, upgrade notes, known limits, missing Figma frames).

## Verification

- `vp test --run tests/integration/audit tests/integration/shifts/crosscheck.test.ts tests/integration/sales/golden` green; the full integration and e2e suites green.
- Break one change on purpose per slice (e.g. skip the anchor check, drop the price `before`) and watch its test fail.
- Real app: seed, run a till sale with a price override, change a price in the portal, close a shift. Then:
  - Product → History → row shows the actor, device and approver;
  - Integrity → Verify all passes;
  - tamper a row in psql → Fail on exactly that entry;
  - trigger the watchdog manually (`scheduled` on cf dev, timer on box) → an anchor row and the email (Maileroo sandbox or logged).

## Known limits to report

- The Archive inclusion waits for Days 41–44 (`auditCsv` is ready for it).
- A day the cron misses has no anchor.
- Tampering on the till before upload is caught as a rejected upload, not repaired.
- The watchdog doesn't yet sweep stale fiscal docs (still a Day 19 note).
